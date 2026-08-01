"""Sales MIS Backend - FastAPI."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Form
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId

from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies,
    get_current_user, seed_admin,
)
from excel_parser import parse_excel, canonicalize_rows, auto_map_columns, CANONICAL_FIELDS
from analytics import (
    overview_kpis, customer_analytics, product_analytics,
    country_analytics, trend_analytics, smart_alerts, salesperson_analytics,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Sales MIS API")
api = APIRouter(prefix="/api")


# ---------- Models ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class DatasetMeta(BaseModel):
    id: str
    name: str
    filename: str
    row_count: int
    headers: List[str]
    mapping: Dict[str, str]
    uploaded_at: str
    is_active: bool


class MappingUpdateRequest(BaseModel):
    mapping: Dict[str, str]


class RowUpdateRequest(BaseModel):
    updates: Dict[str, Any]


class TargetRequest(BaseModel):
    salesperson: str
    month: str  # YYYY-MM
    target: float


# ---------- Helpers ----------
async def _user_dep(request: Request) -> dict:
    return await get_current_user(request, db)


async def _get_active_dataset(user_id: str) -> Optional[dict]:
    return await db.datasets.find_one({"user_id": user_id, "is_active": True})


async def _get_transactions(user_id: str, dataset_id: Optional[str] = None) -> List[dict]:
    ds = None
    if dataset_id:
        ds = await db.datasets.find_one({"_id": ObjectId(dataset_id), "user_id": user_id})
    else:
        ds = await _get_active_dataset(user_id)
    if not ds:
        return []
    cursor = db.transactions.find({"dataset_id": str(ds["_id"])}, {"_id": 0})
    return await cursor.to_list(length=None)


# ---------- Auth Routes ----------
@api.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(req.password),
        "name": req.name or email.split("@")[0],
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": doc["name"], "role": doc["role"]}


@api.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": user.get("name"), "role": user.get("role", "user")}


@api.post("/auth/logout")
async def logout(response: Response, user=Depends(_user_dep)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(_user_dep)):
    return user


# ---------- Dataset Routes ----------
@api.post("/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    user=Depends(_user_dep),
):
    if not file.filename.lower().endswith((".xls", ".xlsx")):
        raise HTTPException(status_code=400, detail="Only .xls or .xlsx files are supported")
    content = await file.read()
    try:
        headers, rows, mapping, header_idx = parse_excel(content, file.filename)
    except Exception as e:
        logger.exception("Excel parse failed")
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel: {e}")
    canon = canonicalize_rows(rows, mapping)

    # Mark prior active datasets inactive
    await db.datasets.update_many({"user_id": user["id"], "is_active": True}, {"$set": {"is_active": False}})

    ds_doc = {
        "user_id": user["id"],
        "name": name or file.filename,
        "filename": file.filename,
        "headers": headers,
        "mapping": mapping,
        "header_row": header_idx,
        "row_count": len(canon),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
    }
    res = await db.datasets.insert_one(ds_doc)
    dataset_id = str(res.inserted_id)
    if canon:
        for i, tx in enumerate(canon):
            tx["row_id"] = f"{dataset_id}_{i}"
            tx["dataset_id"] = dataset_id
            tx["user_id"] = user["id"]
        # Insert in batches
        batch = 1000
        for i in range(0, len(canon), batch):
            await db.transactions.insert_many(canon[i:i + batch])

    return {
        "id": dataset_id, "name": ds_doc["name"], "filename": file.filename,
        "row_count": len(canon), "headers": headers, "mapping": mapping,
        "uploaded_at": ds_doc["uploaded_at"], "is_active": True,
        "canonical_fields": list(CANONICAL_FIELDS.keys()),
    }


@api.get("/datasets")
async def list_datasets(user=Depends(_user_dep)):
    cursor = db.datasets.find({"user_id": user["id"]}).sort("uploaded_at", -1)
    out = []
    async for d in cursor:
        out.append({
            "id": str(d["_id"]), "name": d["name"], "filename": d["filename"],
            "row_count": d["row_count"], "uploaded_at": d["uploaded_at"],
            "is_active": d.get("is_active", False), "headers": d["headers"], "mapping": d["mapping"],
        })
    return out


@api.post("/datasets/{dataset_id}/activate")
async def activate_dataset(dataset_id: str, user=Depends(_user_dep)):
    ds = await db.datasets.find_one({"_id": ObjectId(dataset_id), "user_id": user["id"]})
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    await db.datasets.update_many({"user_id": user["id"], "is_active": True}, {"$set": {"is_active": False}})
    await db.datasets.update_one({"_id": ObjectId(dataset_id)}, {"$set": {"is_active": True}})
    return {"ok": True}


@api.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str, user=Depends(_user_dep)):
    ds = await db.datasets.find_one({"_id": ObjectId(dataset_id), "user_id": user["id"]})
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    await db.transactions.delete_many({"dataset_id": dataset_id})
    await db.datasets.delete_one({"_id": ObjectId(dataset_id)})
    return {"ok": True}


@api.put("/datasets/{dataset_id}/mapping")
async def update_mapping(dataset_id: str, req: MappingUpdateRequest, user=Depends(_user_dep)):
    ds = await db.datasets.find_one({"_id": ObjectId(dataset_id), "user_id": user["id"]})
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    # Re-canonicalize existing raw rows with new mapping.
    cursor = db.transactions.find({"dataset_id": dataset_id})
    txs = await cursor.to_list(length=None)
    rows = [t["raw"] for t in txs]
    new_canon = canonicalize_rows(rows, req.mapping)
    # Preserve row_ids and user edits — re-apply edited values
    for i, (orig, new) in enumerate(zip(txs, new_canon)):
        new["row_id"] = orig["row_id"]
        new["dataset_id"] = dataset_id
        new["user_id"] = user["id"]
        if orig.get("edits"):
            new.update(orig["edits"])
            new["edits"] = orig["edits"]
    # Replace
    await db.transactions.delete_many({"dataset_id": dataset_id})
    if new_canon:
        for i in range(0, len(new_canon), 1000):
            await db.transactions.insert_many(new_canon[i:i + 1000])
    await db.datasets.update_one({"_id": ObjectId(dataset_id)}, {"$set": {"mapping": req.mapping, "row_count": len(new_canon)}})
    return {"ok": True, "row_count": len(new_canon)}


# ---------- Data Editor ----------
@api.get("/transactions")
async def list_transactions(
    dataset_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    only_missing: bool = False,
    search: Optional[str] = None,
    user=Depends(_user_dep),
):
    ds = None
    if dataset_id:
        ds = await db.datasets.find_one({"_id": ObjectId(dataset_id), "user_id": user["id"]})
    else:
        ds = await _get_active_dataset(user["id"])
    if not ds:
        return {"rows": [], "total": 0, "headers": [], "mapping": {}, "canonical_fields": list(CANONICAL_FIELDS.keys())}

    query = {"dataset_id": str(ds["_id"])}
    if only_missing:
        query["missing.0"] = {"$exists": True}
    if search:
        query["$or"] = [
            {"customer": {"$regex": search, "$options": "i"}},
            {"product": {"$regex": search, "$options": "i"}},
            {"invoice_no": {"$regex": search, "$options": "i"}},
        ]

    total = await db.transactions.count_documents(query)
    cursor = db.transactions.find(query, {"_id": 0}).skip(skip).limit(limit)
    rows = await cursor.to_list(length=limit)
    return {
        "rows": rows, "total": total,
        "headers": ds["headers"], "mapping": ds["mapping"],
        "canonical_fields": list(CANONICAL_FIELDS.keys()),
    }


@api.patch("/transactions/{row_id}")
async def update_transaction(row_id: str, req: RowUpdateRequest, user=Depends(_user_dep)):
    tx = await db.transactions.find_one({"row_id": row_id, "user_id": user["id"]})
    if not tx:
        raise HTTPException(status_code=404, detail="Row not found")
    edits = tx.get("edits", {})
    edits.update(req.updates)
    update_doc = {**req.updates, "edits": edits}
    # update missing list
    new_doc = {**tx, **update_doc}
    missing = [k for k in ["customer", "product", "invoice_date", "net_amount"] if not new_doc.get(k)]
    update_doc["missing"] = missing
    await db.transactions.update_one({"row_id": row_id, "user_id": user["id"]}, {"$set": update_doc})
    return {"ok": True}


# ---------- Analytics Routes ----------
@api.get("/analytics/overview")
async def analytics_overview(dataset_id: Optional[str] = None, user=Depends(_user_dep)):
    txs = await _get_transactions(user["id"], dataset_id)
    return overview_kpis(txs)


@api.get("/analytics/customers")
async def analytics_customers(dataset_id: Optional[str] = None, user=Depends(_user_dep)):
    txs = await _get_transactions(user["id"], dataset_id)
    return customer_analytics(txs)


@api.get("/analytics/products")
async def analytics_products(dataset_id: Optional[str] = None, user=Depends(_user_dep)):
    txs = await _get_transactions(user["id"], dataset_id)
    return product_analytics(txs)


@api.get("/analytics/countries")
async def analytics_countries(dataset_id: Optional[str] = None, user=Depends(_user_dep)):
    txs = await _get_transactions(user["id"], dataset_id)
    return country_analytics(txs)


@api.get("/analytics/trends")
async def analytics_trends(dataset_id: Optional[str] = None, user=Depends(_user_dep)):
    txs = await _get_transactions(user["id"], dataset_id)
    return trend_analytics(txs)


@api.get("/analytics/salespersons")
async def analytics_salespersons(dataset_id: Optional[str] = None, user=Depends(_user_dep)):
    txs = await _get_transactions(user["id"], dataset_id)
    targets = await db.targets.find({"user_id": user["id"]}, {"_id": 0}).to_list(length=None)
    return salesperson_analytics(txs, targets)


@api.get("/analytics/alerts")
async def analytics_alerts(dataset_id: Optional[str] = None, user=Depends(_user_dep)):
    txs = await _get_transactions(user["id"], dataset_id)
    targets = await db.targets.find({"user_id": user["id"]}, {"_id": 0}).to_list(length=None)
    return {"alerts": smart_alerts(txs, targets)}


# ---------- Targets ----------
@api.get("/targets")
async def list_targets(user=Depends(_user_dep)):
    cursor = db.targets.find({"user_id": user["id"]}, {"_id": 0}).sort("month", -1)
    return await cursor.to_list(length=None)


@api.post("/targets")
async def create_target(req: TargetRequest, user=Depends(_user_dep)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "salesperson": req.salesperson,
        "month": req.month,
        "target": req.target,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # upsert by (salesperson, month)
    await db.targets.update_one(
        {"user_id": user["id"], "salesperson": req.salesperson, "month": req.month},
        {"$set": doc},
        upsert=True,
    )
    return doc


@api.delete("/targets/{target_id}")
async def delete_target(target_id: str, user=Depends(_user_dep)):
    res = await db.targets.delete_one({"id": target_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Target not found")
    return {"ok": True}


# ---------- Health ----------
@api.get("/")
async def root():
    return {"service": "Sales MIS API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.datasets.create_index([("user_id", 1), ("is_active", 1)])
    await db.transactions.create_index([("dataset_id", 1)])
    await db.transactions.create_index([("dataset_id", 1), ("customer", 1)])
    await db.transactions.create_index([("dataset_id", 1), ("product", 1)])
    await db.transactions.create_index([("dataset_id", 1), ("country", 1)])
    await db.transactions.create_index([("dataset_id", 1), ("year_month", 1)])
    await db.targets.create_index([("user_id", 1), ("salesperson", 1), ("month", 1)], unique=True)
    await seed_admin(db)
    logger.info("Startup complete - indexes created, admin seeded.")


@app.on_event("shutdown")
async def on_stop():
    client.close()

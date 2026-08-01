"""Backend API tests for Sales MIS app."""
import os
import io
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://business-metrics-pro-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@salesmis.com"
ADMIN_PASSWORD = "Admin@123"
SAMPLE_FILE = "/tmp/sample.xls"


# ----------------- Fixtures -----------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def active_dataset_id(admin_session):
    # Use existing dataset or upload new one.
    r = admin_session.get(f"{BASE_URL}/api/datasets")
    assert r.status_code == 200
    datasets = r.json()
    active = next((d for d in datasets if d.get("is_active")), None)
    if active:
        return active["id"]
    # Upload
    with open(SAMPLE_FILE, "rb") as f:
        files = {"file": ("sample.xls", f.read(), "application/vnd.ms-excel")}
    r = admin_session.post(f"{BASE_URL}/api/datasets/upload", files=files, data={"name": "TEST_sample"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ----------------- Health -----------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"


# ----------------- Auth -----------------
class TestAuth:
    def test_login_admin(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d.get("role") in ("admin", "user")
        # cookies must be set
        assert "access_token" in s.cookies.get_dict()
        assert "refresh_token" in s.cookies.get_dict()

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG"})
        assert r.status_code == 401

    def test_me_authenticated(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert "id" in d
        assert "_id" not in d
        assert "password_hash" not in d

    def test_me_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_register_new_user(self):
        unique_email = f"test_user_{int(time.time())}@example.com"
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email, "password": "Pass@123456", "name": "Test User"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == unique_email
        # auto-login: cookies set
        assert "access_token" in s.cookies.get_dict()
        # /me works
        m = s.get(f"{BASE_URL}/api/auth/me")
        assert m.status_code == 200

    def test_register_duplicate_email(self, admin_session):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": ADMIN_EMAIL, "password": "Pass@123456"
        })
        assert r.status_code == 400


# ----------------- Datasets -----------------
class TestDatasets:
    def test_list_datasets(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/datasets")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_upload_dataset(self, admin_session):
        with open(SAMPLE_FILE, "rb") as f:
            files = {"file": ("Outward_Details.xls", f.read(), "application/vnd.ms-excel")}
        r = admin_session.post(f"{BASE_URL}/api/datasets/upload", files=files, data={"name": "TEST_upload"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["row_count"] > 0
        assert isinstance(d["headers"], list) and len(d["headers"]) > 0
        assert isinstance(d["mapping"], dict)
        assert d["is_active"] is True
        # Verify visible in list
        r2 = admin_session.get(f"{BASE_URL}/api/datasets")
        ids = [x["id"] for x in r2.json()]
        assert d["id"] in ids

    def test_dataset_invalid_file(self, admin_session):
        files = {"file": ("bad.txt", b"not excel", "text/plain")}
        r = admin_session.post(f"{BASE_URL}/api/datasets/upload", files=files)
        assert r.status_code == 400


# ----------------- Analytics -----------------
class TestAnalytics:
    def test_overview(self, admin_session, active_dataset_id):
        r = admin_session.get(f"{BASE_URL}/api/analytics/overview")
        assert r.status_code == 200
        d = r.json()
        # Expect KPI keys
        for key in ("total_sales", "total_gp", "orders", "active_customers"):
            assert key in d, f"missing {key}: {list(d.keys())}"

    def test_customers(self, admin_session, active_dataset_id):
        r = admin_session.get(f"{BASE_URL}/api/analytics/customers")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, dict)

    def test_products(self, admin_session, active_dataset_id):
        r = admin_session.get(f"{BASE_URL}/api/analytics/products")
        assert r.status_code == 200

    def test_countries(self, admin_session, active_dataset_id):
        r = admin_session.get(f"{BASE_URL}/api/analytics/countries")
        assert r.status_code == 200

    def test_trends(self, admin_session, active_dataset_id):
        r = admin_session.get(f"{BASE_URL}/api/analytics/trends")
        assert r.status_code == 200

    def test_salespersons(self, admin_session, active_dataset_id):
        r = admin_session.get(f"{BASE_URL}/api/analytics/salespersons")
        assert r.status_code == 200

    def test_alerts(self, admin_session, active_dataset_id):
        r = admin_session.get(f"{BASE_URL}/api/analytics/alerts")
        assert r.status_code == 200
        d = r.json()
        assert "alerts" in d
        assert isinstance(d["alerts"], list)


# ----------------- Transactions -----------------
class TestTransactions:
    def test_list_transactions(self, admin_session, active_dataset_id):
        r = admin_session.get(f"{BASE_URL}/api/transactions?skip=0&limit=10")
        assert r.status_code == 200
        d = r.json()
        assert "rows" in d and "total" in d
        assert isinstance(d["rows"], list)
        assert d["total"] >= 0

    def test_patch_transaction(self, admin_session, active_dataset_id):
        # Get a row
        r = admin_session.get(f"{BASE_URL}/api/transactions?skip=0&limit=1")
        assert r.status_code == 200
        rows = r.json()["rows"]
        if not rows:
            pytest.skip("No rows in dataset")
        row_id = rows[0]["row_id"]
        new_customer = "TEST_EDITED_CUST"
        p = admin_session.patch(f"{BASE_URL}/api/transactions/{row_id}", json={"updates": {"customer": new_customer}})
        assert p.status_code == 200, p.text
        # Verify persistence
        r2 = admin_session.get(f"{BASE_URL}/api/transactions?search={new_customer}&limit=5")
        assert r2.status_code == 200
        rows2 = r2.json()["rows"]
        assert any(x.get("customer") == new_customer for x in rows2), "edited row not found"


# ----------------- Targets -----------------
class TestTargets:
    def test_create_list_delete_target(self, admin_session):
        payload = {"salesperson": "TEST_SALESPERSON", "month": "2025-12", "target": 100000.0}
        c = admin_session.post(f"{BASE_URL}/api/targets", json=payload)
        assert c.status_code == 200, c.text
        target_id = c.json()["id"]
        # list
        l = admin_session.get(f"{BASE_URL}/api/targets")
        assert l.status_code == 200
        assert any(t["id"] == target_id for t in l.json())
        # delete
        d = admin_session.delete(f"{BASE_URL}/api/targets/{target_id}")
        assert d.status_code == 200
        # verify removed
        l2 = admin_session.get(f"{BASE_URL}/api/targets")
        assert not any(t["id"] == target_id for t in l2.json())

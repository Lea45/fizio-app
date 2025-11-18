import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import "../styles/user-management.css";

interface User {
  id: string;
  name: string;
  phone: string;
  remainingVisits: number;
  validUntil: string;
}

export default function UserManagement() {
  const PAGE_SIZE = 5;

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [additionalVisits, setAdditionalVisits] = useState("");
  const [existingVisits, setExistingVisits] = useState(0);
  const [validUntil, setValidUntil] = useState("");

  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [lastVisible, setLastVisible] =
    useState<QueryDocumentSnapshot | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  /* ============================
          FETCH USERS
  ============================ */

  const docToUser = (d: any): User => ({
    id: d.id,
    name: d.data().name,
    phone: d.data().phone,
    remainingVisits: d.data().remainingVisits || 0,
    validUntil: d.data().validUntil || "",
  });

  const fetchUsers = async () => {
    const q = query(collection(db, "users"), orderBy("name"), limit(PAGE_SIZE));
    const snap = await getDocs(q);

    setUsers(snap.docs.map(docToUser));
    setLastVisible(snap.docs[snap.docs.length - 1] || null);
    setHasMore(snap.docs.length === PAGE_SIZE);
  };

  const fetchMoreUsers = async () => {
    if (!lastVisible) return;
    setLoadingMore(true);

    const q = query(
      collection(db, "users"),
      orderBy("name"),
      startAfter(lastVisible),
      limit(PAGE_SIZE)
    );

    const snap = await getDocs(q);
    setUsers((prev) => [...prev, ...snap.docs.map(docToUser)]);
    setLastVisible(snap.docs[snap.docs.length - 1] || null);
    setHasMore(snap.docs.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  /* ============================
          SEARCH
  ============================ */

  const searchUsers = async (term: string) => {
    const t = term.trim().toLowerCase();
    if (!t) {
      fetchUsers();
      return;
    }

    const q = query(collection(db, "users"), orderBy("name"));
    const snap = await getDocs(q);
    const all = snap.docs.map(docToUser);

    const filtered = all.filter(
      (u) =>
        u.name.toLowerCase().includes(t) ||
        u.phone.replace(/\s+/g, "").includes(t.replace(/\s+/g, ""))
    );

    setUsers(filtered);
    setHasMore(false);
  };

  useEffect(() => {
    searchUsers(searchTerm);
  }, [searchTerm]);

  /* ============================
          ADD USER
  ============================ */

  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserPhone.trim()) return;

    await addDoc(collection(db, "users"), {
      name: newUserName.trim(),
      phone: newUserPhone.trim(),
      remainingVisits: 0,
      validUntil: "",
    });

    setNewUserName("");
    setNewUserPhone("");
    fetchUsers();
  };

  /* ============================
        DELETE USER
  ============================ */

  const confirmDeleteUser = (user: User) => {
    setUserToDelete(user);
  };

  const handleDeleteUserConfirmed = async () => {
    if (!userToDelete) return;
    await deleteDoc(doc(db, "users", userToDelete.id));
    setUserToDelete(null);
    fetchUsers();
  };

  /* ============================
      OPEN DETAILS / UPDATE VISITS
  ============================ */

  const openUserDetails = async (user: User) => {
    const ref = doc(db, "users", user.id);
    const snap = await getDoc(ref);
    const data = snap.data();

    setSelectedUser(user);
    setExistingVisits(data?.remainingVisits ?? 0);
    setValidUntil(data?.validUntil || "");
    setAdditionalVisits("0");
  };

  const handleConfirmEntry = async () => {
    if (!selectedUser) return;
    const numberAdd = Number(additionalVisits || "0");

    await updateDoc(doc(db, "users", selectedUser.id), {
      remainingVisits: existingVisits + numberAdd,
      validUntil,
    });

    setSuccessMessage(
      `${numberAdd >= 0 ? "Dodali" : "Oduzeli"} ste ${Math.abs(
        numberAdd
      )} dolazaka za ${selectedUser.name}.`
    );
    setShowSuccess(true);
    setShowConfirm(false);
  };

  /* ============================
            RENDER
  ============================ */

  return (
    <>
      <div className="fizio-user-container">
        <h2>Upravljanje korisnicima</h2>

        {/* Dodavanje korisnika */}
        <div className="fizio-user-inputs">
          <input
            type="text"
            placeholder="Ime i prezime"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
          />

          <input
            type="tel"
            placeholder="Broj telefona"
            value={newUserPhone}
            onChange={(e) => setNewUserPhone(e.target.value)}
          />

          <button onClick={handleAddUser} className="fizio-btn-main">
            Dodaj
          </button>
        </div>

        {/* Search */}
        <div className="fizio-search-box">
          <input
            type="text"
            placeholder="Pretraži korisnika…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Lista korisnika */}
        <div className="fizio-user-list">
          {users.map((user) => (
            <div className="fizio-user-card" key={user.id}>
              <div>
                <div className="fizio-user-name">{user.name}</div>
                <div className="fizio-user-phone">{user.phone}</div>
              </div>

              <div className="fizio-user-buttons">
  <button
    onClick={() => confirmDeleteUser(user)}
    className="user-btn user-btn-danger"
  >
    Obriši
  </button>

  <button
    onClick={() => openUserDetails(user)}
    className="user-btn user-btn-secondary"
  >
    Detalji
  </button>
</div>

            </div>
          ))}
        </div>

        {hasMore && (
          <button
            onClick={fetchMoreUsers}
            disabled={loadingMore}
            className="load-more-btn"
          >
            {loadingMore ? "Učitavam…" : "Učitaj još"}
          </button>
        )}
      </div>

      {/* MODAL – brisanje korisnika */}
      {userToDelete && (
        <div className="fizio-overlay">
          <div className="fizio-modal">
            <p>
              Želiš obrisati korisnika{" "}
              <strong>{userToDelete.name}</strong>?
            </p>

            <div className="fizio-modal-buttons">
              <button className="yes-btn" onClick={handleDeleteUserConfirmed}>
                Da
              </button>
              <button
                className="no-btn"
                onClick={() => setUserToDelete(null)}
              >
                Ne
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL – detalji / izmjena dolazaka */}
      {selectedUser && (
        <div className="fizio-overlay">
          <div className="fizio-modal">
            <h3>{selectedUser.name}</h3>

            <p>
              Preostali dolasci: <strong>{existingVisits}</strong>
            </p>

            {validUntil && (
              <p>
                Vrijedi do: <strong>{validUntil}</strong>
              </p>
            )}

            <label>Promjena dolazaka:</label>
            <input
              type="number"
              value={additionalVisits}
              onChange={(e) => setAdditionalVisits(e.target.value)}
            />

            <label>Novi datum valjanosti:</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />

            <div className="fizio-modal-buttons">
              <button
                className="yes-btn"
                onClick={() => setShowConfirm(true)}
              >
                Spremi
              </button>
              <button
                className="no-btn"
                onClick={() => setSelectedUser(null)}
              >
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL – potvrda spremanja promjene dolazaka */}
      {showConfirm && (
        <div className="fizio-overlay">
          <div className="fizio-modal">
            <p>
              Primijeniti promjenu dolazaka za{" "}
              <strong>{selectedUser?.name}</strong>?
            </p>

            <div className="fizio-modal-buttons">
              <button className="yes-btn" onClick={handleConfirmEntry}>
                Da
              </button>
              <button
                className="no-btn"
                onClick={() => setShowConfirm(false)}
              >
                Ne
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL – uspjeh */}
      {showSuccess && (
        <div className="fizio-overlay">
          <div className="fizio-modal">
            <p>✅ {successMessage}</p>

            <div className="fizio-modal-buttons">
              <button
                className="yes-btn"
                onClick={() => {
                  setShowSuccess(false);
                  setSelectedUser(null);
                  setAdditionalVisits("");
                  setExistingVisits(0);
                  setValidUntil("");
                  fetchUsers();
                }}
              >
                U redu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

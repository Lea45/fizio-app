import { useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

export default function TestFirebase() {
  useEffect(() => {
    const testFirebase = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "test"));
        querySnapshot.forEach((doc) => {
          console.log("🔥 Firebase connected! Document:", doc.id, doc.data());
        });
      } catch (error) {
        console.error("❌ Firebase error:", error);
      }
    };
    testFirebase();
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <h2>Provjera Firebase veze</h2>
      <p>Otvori konzolu (F12 → Console) i vidi ispis.</p>
    </div>
  );
}

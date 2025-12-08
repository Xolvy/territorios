import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";

interface UseFirestoreCollectionResult<T = DocumentData> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

export function useFirestoreCollection<T = DocumentData>(
  collectionName: string,
  sortField?: string,
  sortDirection: "asc" | "desc" = "desc"
): UseFirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!collectionName) {
      setLoading(false);
      return;
    }

    // Check if db is available
    if (!db) {
      console.warn(
        `Firebase not initialized - collection ${collectionName} not available`
      );
      setError(new Error("Firebase not initialized"));
      setLoading(false);
      return;
    }

    try {
      const collectionRef = collection(db, collectionName);

      let queryRef = sortField
        ? query(collectionRef, orderBy(sortField, sortDirection))
        : collectionRef;

      const unsubscribe = onSnapshot(
        queryRef,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const list = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as T[];
          setData(list);
          setLoading(false);
          setError(null);
        },
        (error) => {
          console.error(`Error al obtener ${collectionName}:`, error);
          setError(error as Error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error(`Error configurando listener para ${collectionName}:`, err);
      setError(err as Error);
      setLoading(false);
    }
  }, [collectionName, sortField, sortDirection]);

  return { data, loading, error };
}

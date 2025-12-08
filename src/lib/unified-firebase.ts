import {
  Territory,
  Block,
  Address,
  PhoneNumber,
  AppUser,
  Assignment,
  Conductor,
  SystemEvent,
  AppStats,
} from "@/types/unified";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  Timestamp,
  onSnapshot,
  startAfter,
  endBefore,
  DocumentSnapshot,
  QueryConstraint,
} from "firebase/firestore";

export class UnifiedFirebaseService {
  // ===== TERRITORY OPERATIONS =====

  async getTerritories(): Promise<Record<string, Territory>> {
    try {
      const snapshot = await getDocs(collection(db, "territories"));
      const territories: Record<string, Territory> = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        territories[doc.id] = {
          id: doc.id,
          ...data,
          ultimaModificacion: data.ultimaModificacion?.toDate(),
        } as Territory;
      });

      return territories;
    } catch (error) {
      console.error("Error fetching territories:", error);
      throw error;
    }
  }

  async createTerritory(territory: Territory): Promise<void> {
    try {
      const territoryData = {
        ...territory,
        ultimaModificacion: Timestamp.now(),
      };
      await setDoc(doc(db, "territories", territory.id), territoryData);
    } catch (error) {
      console.error("Error creating territory:", error);
      throw error;
    }
  }

  async updateTerritory(
    id: string,
    updates: Partial<Territory>
  ): Promise<void> {
    try {
      const updateData = {
        ...updates,
        ultimaModificacion: Timestamp.now(),
      };
      await updateDoc(doc(db, "territories", id), updateData);
    } catch (error) {
      console.error("Error updating territory:", error);
      throw error;
    }
  }

  async deleteTerritory(id: string): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Delete all blocks in territory
      const blocksQuery = query(
        collection(db, "blocks"),
        where("territoryId", "==", id)
      );
      const blocksSnapshot = await getDocs(blocksQuery);

      blocksSnapshot.forEach((blockDoc) => {
        batch.delete(blockDoc.ref);
      });

      // Delete territory
      batch.delete(doc(db, "territories", id));

      await batch.commit();
    } catch (error) {
      console.error("Error deleting territory:", error);
      throw error;
    }
  }

  // ===== BLOCK OPERATIONS =====

  async getBlocks(): Promise<Record<string, Block>> {
    try {
      const snapshot = await getDocs(collection(db, "blocks"));
      const blocks: Record<string, Block> = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        blocks[doc.id] = {
          id: doc.id,
          ...data,
          fechaUltimaVisita: data.fechaUltimaVisita?.toDate(),
        } as Block;
      });

      return blocks;
    } catch (error) {
      console.error("Error fetching blocks:", error);
      throw error;
    }
  }

  async createBlock(block: Block): Promise<void> {
    try {
      await setDoc(doc(db, "blocks", block.id), block);
    } catch (error) {
      console.error("Error creating block:", error);
      throw error;
    }
  }

  async updateBlock(id: string, updates: Partial<Block>): Promise<void> {
    try {
      await updateDoc(doc(db, "blocks", id), updates);
    } catch (error) {
      console.error("Error updating block:", error);
      throw error;
    }
  }

  async deleteBlock(id: string): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Delete all addresses in block
      const addressesQuery = query(
        collection(db, "addresses"),
        where("blockId", "==", id)
      );
      const addressesSnapshot = await getDocs(addressesQuery);

      addressesSnapshot.forEach((addressDoc) => {
        batch.delete(addressDoc.ref);
      });

      // Delete block
      batch.delete(doc(db, "blocks", id));

      await batch.commit();
    } catch (error) {
      console.error("Error deleting block:", error);
      throw error;
    }
  }

  // ===== ADDRESS OPERATIONS =====

  async getAddresses(): Promise<Record<string, Address>> {
    try {
      const snapshot = await getDocs(collection(db, "addresses"));
      const addresses: Record<string, Address> = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        addresses[doc.id] = {
          id: doc.id,
          ...data,
          ultimaVisita: data.ultimaVisita?.toDate(),
        } as Address;
      });

      return addresses;
    } catch (error) {
      console.error("Error fetching addresses:", error);
      throw error;
    }
  }

  async createAddress(address: Address): Promise<void> {
    try {
      await setDoc(doc(db, "addresses", address.id), address);
    } catch (error) {
      console.error("Error creating address:", error);
      throw error;
    }
  }

  async updateAddress(id: string, updates: Partial<Address>): Promise<void> {
    try {
      await updateDoc(doc(db, "addresses", id), updates);
    } catch (error) {
      console.error("Error updating address:", error);
      throw error;
    }
  }

  async deleteAddress(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "addresses", id));
    } catch (error) {
      console.error("Error deleting address:", error);
      throw error;
    }
  }

  // ===== PHONE OPERATIONS =====

  async getPhoneNumbers(): Promise<Record<string, PhoneNumber>> {
    try {
      const snapshot = await getDocs(collection(db, "phoneNumbers"));
      const phones: Record<string, PhoneNumber> = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        phones[doc.id] = {
          id: doc.id,
          ...data,
          fechaUltimaLlamada: data.fechaUltimaLlamada?.toDate(),
          fechaBloqueo: data.fechaBloqueo?.toDate(),
          fechaRevisita: data.fechaRevisita?.toDate(),
          creadoEn: data.creadoEn?.toDate(),
          modificadoEn: data.modificadoEn?.toDate(),
        } as PhoneNumber;
      });

      return phones;
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      throw error;
    }
  }

  async createPhoneNumber(phone: PhoneNumber): Promise<void> {
    try {
      const phoneData = {
        ...phone,
        creadoEn: phone.creadoEn
          ? Timestamp.fromDate(phone.creadoEn)
          : Timestamp.now(),
        modificadoEn: phone.modificadoEn
          ? Timestamp.fromDate(phone.modificadoEn)
          : Timestamp.now(),
        fechaUltimaLlamada: phone.fechaUltimaLlamada
          ? Timestamp.fromDate(phone.fechaUltimaLlamada)
          : null,
        fechaBloqueo: phone.fechaBloqueo
          ? Timestamp.fromDate(phone.fechaBloqueo)
          : null,
        fechaRevisita: phone.fechaRevisita
          ? Timestamp.fromDate(phone.fechaRevisita)
          : null,
      };
      await setDoc(doc(db, "phoneNumbers", phone.id), phoneData);
    } catch (error) {
      console.error("Error creating phone number:", error);
      throw error;
    }
  }

  async updatePhoneNumber(
    id: string,
    updates: Partial<PhoneNumber>
  ): Promise<void> {
    try {
      const updateData = {
        ...updates,
        modificadoEn: Timestamp.now(),
        fechaUltimaLlamada: updates.fechaUltimaLlamada
          ? Timestamp.fromDate(updates.fechaUltimaLlamada)
          : undefined,
        fechaBloqueo: updates.fechaBloqueo
          ? Timestamp.fromDate(updates.fechaBloqueo)
          : undefined,
        fechaRevisita: updates.fechaRevisita
          ? Timestamp.fromDate(updates.fechaRevisita)
          : undefined,
      };

      // Remove undefined values
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      await updateDoc(doc(db, "phoneNumbers", id), updateData);
    } catch (error) {
      console.error("Error updating phone number:", error);
      throw error;
    }
  }

  async deletePhoneNumber(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "phoneNumbers", id));
    } catch (error) {
      console.error("Error deleting phone number:", error);
      throw error;
    }
  }

  async bulkCreatePhoneNumbers(phones: PhoneNumber[]): Promise<void> {
    try {
      const batch = writeBatch(db);

      phones.forEach((phone) => {
        const phoneData = {
          ...phone,
          creadoEn: phone.creadoEn
            ? Timestamp.fromDate(phone.creadoEn)
            : Timestamp.now(),
          modificadoEn: phone.modificadoEn
            ? Timestamp.fromDate(phone.modificadoEn)
            : Timestamp.now(),
        };
        batch.set(doc(db, "phoneNumbers", phone.id), phoneData);
      });

      await batch.commit();
    } catch (error) {
      console.error("Error bulk creating phone numbers:", error);
      throw error;
    }
  }

  // ===== USER OPERATIONS =====

  async getUsers(): Promise<Record<string, AppUser>> {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const users: Record<string, AppUser> = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        users[doc.id] = {
          uid: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
        } as AppUser;
      });

      return users;
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  }

  async createUser(user: AppUser): Promise<void> {
    try {
      const userData = {
        ...user,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastLogin: user.lastLogin ? Timestamp.fromDate(user.lastLogin) : null,
      };
      await setDoc(doc(db, "users", user.uid), userData);
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUser(uid: string, updates: Partial<AppUser>): Promise<void> {
    try {
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
        lastLogin: updates.lastLogin
          ? Timestamp.fromDate(updates.lastLogin)
          : undefined,
      };

      // Remove undefined values
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      await updateDoc(doc(db, "users", uid), updateData);
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }

  async deleteUser(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "users", uid));
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }

  // ===== ASSIGNMENT OPERATIONS =====

  async getAssignments(): Promise<Record<string, Assignment>> {
    try {
      const snapshot = await getDocs(collection(db, "assignments"));
      const assignments: Record<string, Assignment> = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        assignments[doc.id] = {
          id: doc.id,
          ...data,
          fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
          fechaVencimiento: data.fechaVencimiento?.toDate(),
        } as Assignment;
      });

      return assignments;
    } catch (error) {
      console.error("Error fetching assignments:", error);
      throw error;
    }
  }

  async createAssignment(assignment: Assignment): Promise<void> {
    try {
      const assignmentData = {
        ...assignment,
        fechaAsignacion: Timestamp.fromDate(assignment.fechaAsignacion),
        fechaVencimiento: assignment.fechaVencimiento
          ? Timestamp.fromDate(assignment.fechaVencimiento)
          : null,
      };
      await setDoc(doc(db, "assignments", assignment.id), assignmentData);
    } catch (error) {
      console.error("Error creating assignment:", error);
      throw error;
    }
  }

  async updateAssignment(
    id: string,
    updates: Partial<Assignment>
  ): Promise<void> {
    try {
      const updateData = {
        ...updates,
        fechaAsignacion: updates.fechaAsignacion
          ? Timestamp.fromDate(updates.fechaAsignacion)
          : undefined,
        fechaVencimiento: updates.fechaVencimiento
          ? Timestamp.fromDate(updates.fechaVencimiento)
          : undefined,
      };

      // Remove undefined values
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      await updateDoc(doc(db, "assignments", id), updateData);
    } catch (error) {
      console.error("Error updating assignment:", error);
      throw error;
    }
  }

  async deleteAssignment(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "assignments", id));
    } catch (error) {
      console.error("Error deleting assignment:", error);
      throw error;
    }
  }

  // ===== CONDUCTOR OPERATIONS =====

  async getConductores(): Promise<Record<string, Conductor>> {
    try {
      const snapshot = await getDocs(collection(db, "conductores"));
      const conductores: Record<string, Conductor> = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        conductores[doc.id] = {
          id: doc.id,
          ...data,
          fechaRegistro: data.fechaRegistro?.toDate() || new Date(),
        } as Conductor;
      });

      return conductores;
    } catch (error) {
      console.error("Error fetching conductores:", error);
      throw error;
    }
  }

  async createConductor(conductor: Conductor): Promise<void> {
    try {
      const conductorData = {
        ...conductor,
        fechaRegistro: Timestamp.fromDate(conductor.fechaRegistro),
      };
      await setDoc(doc(db, "conductores", conductor.id), conductorData);
    } catch (error) {
      console.error("Error creating conductor:", error);
      throw error;
    }
  }

  // ===== SYSTEM EVENT OPERATIONS =====

  async logSystemEvent(event: SystemEvent): Promise<void> {
    try {
      const eventData = {
        ...event,
        timestamp: Timestamp.fromDate(event.timestamp),
      };
      await setDoc(doc(db, "systemEvents", event.id), eventData);
    } catch (error) {
      console.error("Error logging system event:", error);
      // Don't throw error for logging failures
    }
  }

  async getSystemEvents(limit_count: number = 100): Promise<SystemEvent[]> {
    try {
      const q = query(
        collection(db, "systemEvents"),
        orderBy("timestamp", "desc"),
        limit(limit_count)
      );
      const snapshot = await getDocs(q);

      const events: SystemEvent[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        events.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
        } as SystemEvent);
      });

      return events;
    } catch (error) {
      console.error("Error fetching system events:", error);
      return [];
    }
  }

  // ===== REAL-TIME LISTENERS =====

  onTerritoriesChange(
    callback: (territories: Record<string, Territory>) => void
  ): () => void {
    return onSnapshot(
      collection(db, "territories"),
      (snapshot) => {
        const territories: Record<string, Territory> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          territories[doc.id] = {
            id: doc.id,
            ...data,
            ultimaModificacion: data.ultimaModificacion?.toDate(),
          } as Territory;
        });
        callback(territories);
      },
      (error) => {
        console.error("Territories listener error:", error);
      }
    );
  }

  onBlocksChange(
    callback: (blocks: Record<string, Block>) => void
  ): () => void {
    return onSnapshot(
      collection(db, "blocks"),
      (snapshot) => {
        const blocks: Record<string, Block> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          blocks[doc.id] = {
            id: doc.id,
            ...data,
            fechaUltimaVisita: data.fechaUltimaVisita?.toDate(),
          } as Block;
        });
        callback(blocks);
      },
      (error) => {
        console.error("Blocks listener error:", error);
      }
    );
  }

  onPhoneNumbersChange(
    callback: (phones: Record<string, PhoneNumber>) => void
  ): () => void {
    return onSnapshot(
      collection(db, "phoneNumbers"),
      (snapshot) => {
        const phones: Record<string, PhoneNumber> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          phones[doc.id] = {
            id: doc.id,
            ...data,
            fechaUltimaLlamada: data.fechaUltimaLlamada?.toDate(),
            fechaBloqueo: data.fechaBloqueo?.toDate(),
            fechaRevisita: data.fechaRevisita?.toDate(),
            creadoEn: data.creadoEn?.toDate(),
            modificadoEn: data.modificadoEn?.toDate(),
          } as PhoneNumber;
        });
        callback(phones);
      },
      (error) => {
        console.error("Phone numbers listener error:", error);
      }
    );
  }

  onUsersChange(
    callback: (users: Record<string, AppUser>) => void
  ): () => void {
    return onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const users: Record<string, AppUser> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          users[doc.id] = {
            uid: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            lastLogin: data.lastLogin?.toDate(),
          } as AppUser;
        });
        callback(users);
      },
      (error) => {
        console.error("Users listener error:", error);
      }
    );
  }

  onAssignmentsChange(
    callback: (assignments: Record<string, Assignment>) => void
  ): () => void {
    return onSnapshot(
      collection(db, "assignments"),
      (snapshot) => {
        const assignments: Record<string, Assignment> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          assignments[doc.id] = {
            id: doc.id,
            ...data,
            fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
            fechaVencimiento: data.fechaVencimiento?.toDate(),
          } as Assignment;
        });
        callback(assignments);
      },
      (error) => {
        console.error("Assignments listener error:", error);
      }
    );
  }

  // ===== UTILITY FUNCTIONS =====

  async searchPhoneNumbers(
    query: string,
    limit_count: number = 50
  ): Promise<PhoneNumber[]> {
    try {
      // Simple search implementation - in production, consider using Algolia or similar
      const snapshot = await getDocs(collection(db, "phoneNumbers"));
      const phones: PhoneNumber[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const phone = {
          id: doc.id,
          ...data,
          fechaUltimaLlamada: data.fechaUltimaLlamada?.toDate(),
          fechaBloqueo: data.fechaBloqueo?.toDate(),
          fechaRevisita: data.fechaRevisita?.toDate(),
          creadoEn: data.creadoEn?.toDate(),
          modificadoEn: data.modificadoEn?.toDate(),
        } as PhoneNumber;

        if (
          phone.nombre.toLowerCase().includes(query.toLowerCase()) ||
          phone.telefono.includes(query) ||
          phone.direccion.toLowerCase().includes(query.toLowerCase())
        ) {
          phones.push(phone);
        }
      });

      return phones.slice(0, limit_count);
    } catch (error) {
      console.error("Error searching phone numbers:", error);
      throw error;
    }
  }

  async getStatistics(): Promise<AppStats> {
    try {
      const [territories, blocks, assignments, phones, users] =
        await Promise.all([
          this.getTerritories(),
          this.getBlocks(),
          this.getAssignments(),
          this.getPhoneNumbers(),
          this.getUsers(),
        ]);

      const territoryValues = Object.values(territories);
      const blockValues = Object.values(blocks);
      const assignmentValues = Object.values(assignments);
      const phoneValues = Object.values(phones);
      const userValues = Object.values(users);

      return {
        territories: {
          total: territoryValues.length,
          active: territoryValues.filter((t) => t.activo).length,
          assigned: territoryValues.filter((t) => t.asignaciones.length > 0)
            .length,
          completed: territoryValues.filter((t) =>
            t.manzanas.every((b) => b.estado === "completado")
          ).length,
        },
        blocks: {
          total: blockValues.length,
          available: blockValues.filter((b) => b.estado === "pendiente").length,
          assigned: blockValues.filter((b) => b.estado === "asignado").length,
          completed: blockValues.filter((b) => b.estado === "completado")
            .length,
        },
        assignments: {
          active: assignmentValues.filter((a) => a.estado === "activo").length,
          completed: assignmentValues.filter((a) => a.estado === "completado")
            .length,
          expired: assignmentValues.filter((a) => a.estado === "vencido")
            .length,
          avgCompletionDays: 0, // TODO: Calculate based on actual data
        },
        phones: {
          total: phoneValues.length,
          contacted: phoneValues.filter((p) => p.estado === "Contestaron")
            .length,
          pending: phoneValues.filter((p) => p.estado === "").length,
          blocked: phoneValues.filter((p) => p.estado === "No llamar").length,
          studies: phoneValues.filter((p) => p.estado === "Estudio").length,
        },
        users: {
          total: userValues.length,
          active: userValues.filter((u) => u.isActive).length,
          admins: userValues.filter((u) => u.role === "admin").length,
          superAdmins: userValues.filter((u) => u.role === "super-admin")
            .length,
          conductores: userValues.filter((u) => u.role === "conductor").length,
        },
      };
    } catch (error) {
      console.error("Error getting statistics:", error);
      throw error;
    }
  }

  // ===== BACKUP AND EXPORT FUNCTIONS =====

  async exportAllData(): Promise<any> {
    try {
      const [territories, blocks, addresses, phones, users, assignments] =
        await Promise.all([
          this.getTerritories(),
          this.getBlocks(),
          this.getAddresses(),
          this.getPhoneNumbers(),
          this.getUsers(),
          this.getAssignments(),
        ]);

      return {
        territories,
        blocks,
        addresses,
        phoneNumbers: phones,
        users,
        assignments,
        exportDate: new Date().toISOString(),
        version: "1.0",
      };
    } catch (error) {
      console.error("Error exporting data:", error);
      throw error;
    }
  }
}

// Singleton instance
export const firebaseService = new UnifiedFirebaseService();

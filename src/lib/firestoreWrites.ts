// Every database write in the app goes through these wrappers, so that the
// founder's "view as" mode can never change real data by accident.
import {
  addDoc as fbAddDoc,
  deleteDoc as fbDeleteDoc,
  runTransaction as fbRunTransaction,
  setDoc as fbSetDoc,
  updateDoc as fbUpdateDoc,
  writeBatch as fbWriteBatch,
} from 'firebase/firestore';
import { guardWrite } from './simulation';

export const setDoc = ((...args: unknown[]) => {
  guardWrite();
  return (fbSetDoc as any)(...args);
}) as typeof fbSetDoc;

export const updateDoc = ((...args: unknown[]) => {
  guardWrite();
  return (fbUpdateDoc as any)(...args);
}) as typeof fbUpdateDoc;

export const addDoc = ((...args: unknown[]) => {
  guardWrite();
  return (fbAddDoc as any)(...args);
}) as typeof fbAddDoc;

export const deleteDoc = ((...args: unknown[]) => {
  guardWrite();
  return (fbDeleteDoc as any)(...args);
}) as typeof fbDeleteDoc;

export const runTransaction = ((...args: unknown[]) => {
  guardWrite();
  return (fbRunTransaction as any)(...args);
}) as typeof fbRunTransaction;

/** Batches are checked when committed. */
export const writeBatch: typeof fbWriteBatch = (firestore) => {
  const batch = fbWriteBatch(firestore);
  const commit = batch.commit.bind(batch);
  batch.commit = () => {
    guardWrite();
    return commit();
  };
  return batch;
};

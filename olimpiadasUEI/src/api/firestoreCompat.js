import api from './axios';

// Firestore collection
export const collection = (db, path) => ({ path });

// Firestore doc
export const doc = (db, path, id) => {
  // Sometimes doc is called as doc(db, "collection", "id")
  // Or doc(db, "collection/id")
  if (!id) {
    const parts = path.split('/');
    if (parts.length === 2) {
      return { path: parts[0], id: parts[1] };
    }
    return { path };
  }
  return { path, id };
};

// Firestore query
export const query = (collectionRef, ...constraints) => {
  return { ...collectionRef, constraints };
};

// Firestore where
export const where = (field, op, value) => {
  return { field, op, value };
};

// Helper for snapshot format
const createSnapshot = (data, path) => {
  const docs = data.map(item => ({
    id: item.id,
    ref: { path, id: item.id },
    data: () => item
  }));

  return {
    empty: docs.length === 0,
    docs,
    size: docs.length,
    forEach: (cb) => docs.forEach(cb)
  };
};

const mapPath = (path) => {
  const map = {
    'nivelesEducacionales': 'niveles'
  };
  return map[path] || path;
};

// Firestore getDocs
export const getDocs = async (queryRef) => {
  const params = {};
  if (queryRef.constraints) {
    queryRef.constraints.forEach(c => {
      if (c.op === '==') params[c.field] = c.value;
    });
  }
  const apiPath = mapPath(queryRef.path);
  const response = await api.get(`/${apiPath}`, { params });
  return createSnapshot(response.data, queryRef.path);
};

// Firestore getDoc
export const getDoc = async (docRef) => {
  try {
    const apiPath = mapPath(docRef.path);
    const response = await api.get(`/${apiPath}/${docRef.id}`);
    return {
      exists: () => !!response.data,
      data: () => response.data,
      id: response.data?.id
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return { exists: () => false, data: () => null, id: docRef.id };
    }
    throw error;
  }
};

// Función para sanitizar datos (remover campos específicos de Firebase que Prisma no acepta)
const sanitizeData = (data) => {
  const { fechaCreacion, ...cleanData } = data;
  return cleanData;
};

// Firestore addDoc
export const addDoc = async (collectionRef, data) => {
  const apiPath = mapPath(collectionRef.path);
  const response = await api.post(`/${apiPath}`, sanitizeData(data));
  return { id: response.data.id, path: collectionRef.path };
};

// Firestore setDoc (often used with doc())
export const setDoc = async (docRef, data) => {
  const apiPath = mapPath(docRef.path);
  const response = await api.put(`/${apiPath}/${docRef.id}`, sanitizeData(data));
  return response.data;
};

// Firestore updateDoc
export const updateDoc = async (docRef, data) => {
  const apiPath = mapPath(docRef.path);
  const response = await api.put(`/${apiPath}/${docRef.id}`, sanitizeData(data));
  return response.data;
};

// Firestore deleteDoc
export const deleteDoc = async (docRef) => {
  const apiPath = mapPath(docRef.path);
  await api.delete(`/${apiPath}/${docRef.id}`);
};

// Firestore onSnapshot (Realtime listener simulation)
export const onSnapshot = (queryRef, callback) => {
  // Call initially
  getDocs(queryRef)
    .then(snapshot => callback(snapshot))
    .catch(console.error);
  
  // Setup polling every 5 seconds
  const intervalId = setInterval(() => {
    getDocs(queryRef)
      .then(snapshot => callback(snapshot))
      .catch(console.error);
  }, 5000);

  // Return unsubscribe function
  return () => clearInterval(intervalId);
};

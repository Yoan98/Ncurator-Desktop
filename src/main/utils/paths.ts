import { app } from 'electron';
import path from 'path';

export const USER_DATA_PATH = app.getPath('userData');
export const DB_PATH = path.join(USER_DATA_PATH, 'lancedb');
export const INDEX_PATH = path.join(USER_DATA_PATH, 'flexsearch');
export const MODELS_PATH = path.join(USER_DATA_PATH, 'models');

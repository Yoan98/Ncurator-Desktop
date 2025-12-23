import { app } from 'electron'
import path from 'path'

export const USER_DATA_PATH = app.getPath('userData')
export const VECTOR_DB_PATH = path.join(USER_DATA_PATH, 'vector_db')
export const FULL_TEXT_DB_PATH = path.join(USER_DATA_PATH, 'full_text_db')
export const MODELS_PATH = path.join(USER_DATA_PATH, 'models')

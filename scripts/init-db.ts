import { initDatabase } from '../electron/db/client'

const database = initDatabase()

console.log(`Database ready at: ${database.name}`)


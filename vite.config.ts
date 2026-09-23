import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { existsSync, createReadStream } from 'node:fs'
import { resolve } from 'node:path'

const localPipa = resolve('pipa-preview.local')
const pipaNotes = [45,49,53,57,62,66,72,76,79]
const localPipaReady = pipaNotes.every(note => existsSync(resolve(localPipa, `${note}.wav`)))

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  define: { 'import.meta.env.VITE_LOCAL_PIPA': JSON.stringify(command === 'serve' && localPipaReady) },
  plugins: [react(), {
    name: 'local-pipa-preview',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0]
        const note = pipaNotes.find(n => pathname === `/__local-pipa/${n}.wav`)
        if (!localPipaReady || note === undefined) return next()
        res.setHeader('Content-Type', 'audio/wav')
        res.setHeader('Cache-Control', 'no-store')
        const stream = createReadStream(resolve(localPipa, `${note}.wav`))
        stream.on('error', () => { res.statusCode = 500; res.end() })
        stream.pipe(res)
      })
    },
  }],
}))

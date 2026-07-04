/**
 * Vite Plugin: Tự động khởi động Zalo Personal Bridge khi chạy `vite dev`.
 * Bridge chạy trên cổng 3847, tự tắt khi Vite tắt.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default function zaloBridgePlugin() {
  /** @type {import('node:child_process').ChildProcess | null} */
  let bridgeProcess = null

  return {
    name: 'vite-plugin-zalo-bridge',
    apply: 'serve', // Chỉ chạy khi dev, không chạy khi build

    configureServer() {
      const serverPath = path.join(__dirname, 'server.mjs')

      if (!fs.existsSync(serverPath)) {
        console.warn('[ZaloBridge] Không tìm thấy server.mjs, bỏ qua.')
        return
      }

      console.log('\n🔌 [ZaloBridge] Đang khởi động bridge trên cổng 3847...')

      bridgeProcess = spawn('node', ['server.mjs'], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
        // Windows: cần shell để hỗ trợ kill process tree
        shell: process.platform === 'win32',
      })

      bridgeProcess.stdout?.on('data', (data) => {
        const msg = data.toString().trim()
        if (msg) console.log(`🔌 [ZaloBridge] ${msg}`)
      })

      bridgeProcess.stderr?.on('data', (data) => {
        const msg = data.toString().trim()
        if (msg) console.error(`🔌 [ZaloBridge] ❌ ${msg}`)
      })

      bridgeProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
          console.warn(`🔌 [ZaloBridge] Bridge thoát với mã ${code}`)
        }
        bridgeProcess = null
      })

      // Cleanup khi Vite tắt
      const cleanup = () => {
        if (bridgeProcess && !bridgeProcess.killed) {
          console.log('🔌 [ZaloBridge] Đang tắt bridge...')
          if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(bridgeProcess.pid), '/f', '/t'], {
              stdio: 'ignore',
            })
          } else {
            bridgeProcess.kill('SIGTERM')
          }
          bridgeProcess = null
        }
      }

      process.on('exit', cleanup)
      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)
    },
  }
}

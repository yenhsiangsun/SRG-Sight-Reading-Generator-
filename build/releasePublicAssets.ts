import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { getRecordedSoundProfile } from '../src/audio/playbackProfiles.ts'

// Historical audition files remain available to local development and source
// tests. They are not selected by the packaged app's playback routing.
export const ARCHIVED_SAMPLE_DIRECTORIES = [
  'samples/erhu',
  'samples/erhu-bisa',
  'samples/pipa',
] as const

export function isReleasePublicAsset(file: string): boolean {
  const normalized = file.split(sep).join('/').replaceAll('\\', '/')
  if (normalized === 'favicon.svg' || normalized === 'icons.svg') return false
  return !ARCHIVED_SAMPLE_DIRECTORIES.some(directory =>
    normalized === directory || normalized.startsWith(`${directory}/`))
}

function isWithin(root: string, file: string): boolean {
  const path = relative(root, file)
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

interface SampleBank { folder: string; urls: Record<string, string> }

export function copyReleasePublicAssets(publicDir: string, outDir: string, manifestPath: string): void {
  const source = resolve(publicDir), destination = resolve(outDir)
  if (isWithin(source, destination) || isWithin(destination, source)) {
    throw new Error('Release public assets require separate source and output directories')
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, SampleBank>
  // Manifest entries can survive after an instrument switches to a substitute.
  // Follow the same production routing as createPlaybackInstrument before
  // deciding which banks are required; local Pipa is a serve-only override.
  const profiles = new Set(Object.keys(manifest).map(getRecordedSoundProfile))
  const required = [...profiles].flatMap(profile => {
    const bank = manifest[profile]
    if (!bank) throw new Error(`Missing release sample bank: ${profile}`)
    return Object.values(bank.urls).map(file => resolve(source, 'samples', bank.folder, file))
  })
  for (const file of required) {
    if (!isWithin(source, file) || !isReleasePublicAsset(relative(source, file))) {
      throw new Error(`Active playback uses an excluded release sample: ${file}`)
    }
    if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`Missing release sample: ${file}`)
  }
  mkdirSync(destination, { recursive: true })
  cpSync(source, destination, {
    recursive: true,
    filter: file => isReleasePublicAsset(relative(source, file)),
  })
  // Refuse stale output made with emptyOutDir:false rather than silently shipping
  // an archived recording. Source archives are never deleted by this process.
  for (const directory of ARCHIVED_SAMPLE_DIRECTORIES) {
    if (existsSync(resolve(destination, directory))) {
      throw new Error(`Archived sample remains in release output; clean the output directory: ${directory}`)
    }
  }
  for (const file of required) {
    if (!existsSync(resolve(destination, relative(source, file)))) {
      throw new Error(`Sample missing from release output: ${file}`)
    }
  }
}

export function releasePublicAssets(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'release-public-assets',
    apply: 'build',
    config: () => ({ build: { copyPublicDir: false } }),
    configResolved(resolved) { config = resolved },
    writeBundle(options) {
      if (!config.publicDir) return
      copyReleasePublicAssets(
        config.publicDir,
        resolve(config.root, options.dir ?? config.build.outDir),
        resolve(config.root, 'src/audio/sampleManifest.json'),
      )
    },
  }
}

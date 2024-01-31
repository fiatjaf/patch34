import {naddrEncode, neventEncode} from 'nostr-tools/nip19'
import type {Event, NostrEvent} from 'nostr-tools/wasm'
import type {File} from 'parse-diff'
import parseDiff from 'parse-diff'

export type Repo = {
  guid: string
  naddr: string
  event: NostrEvent
  id: string
  name?: string
  description?: string
  web: string[]
  clone: string[]
  relays: string[]
  sourceRelays: string[] // where this event was found, if available
}

export function parseRepo(evt: Event, sourceRelays: string[] = []): Repo {
  const repo: Repo = {
    event: evt,
    id: '',
    clone: [],
    web: [],
    relays: [],
    sourceRelays,

    get guid(): string {
      return this.event.pubkey + '/' + this.id
    },
    get naddr(): string {
      return naddrEncode({
        identifier: this.id,
        kind: 30617,
        pubkey: this.event.pubkey,
        relays: this.sourceRelays
      })
    }
  }
  for (let i = 0; i < evt.tags.length; i++) {
    const tag = evt.tags[i]
    switch (tag[0]) {
      case 'd':
        repo.id = tag[1]
        break
      case 'name':
        repo.name = tag[1]
        break
      case 'description':
        repo.description = tag[1]
        break
      case 'web':
        repo.web!.push(...tag.slice(1))
        break
      case 'clone':
        repo.clone!.push(...tag.slice(1))
        break
      case 'patches':
      case 'issues':
      case 'relays':
        repo.relays!.push(...tag.slice(1))
        break
    }
  }
  return repo
}

export type Patch = {
  event: NostrEvent
  preamble: string
  comment: string
  files: File[]
  nevent: string
  sourceRelays: string[]
  repo:
    | {
        owner: string
        id: string
        relays: string[]
        guid: string
        naddr: string
      }
    | undefined
}

export function parsePatch(
  evt: NostrEvent,
  sourceRelays: string[] = []
): Patch | null {
  const [preamble, rest] = evt.content.split('\n---\n')
  const diffStart = rest.match(/^ \w.* +\| +\d+ +[+-]+/m)?.index
  if (diffStart === undefined) return null
  const comment = rest.substring(0, diffStart)
  const diff = rest.substring(diffStart + 1)

  const files = parseDiff(diff)
  if (files.length === 0) return null

  return {
    event: evt,
    preamble,
    comment,
    files,
    sourceRelays,
    get repo() {
      try {
        const a = evt.tags.find(tag => tag[0] === 'a')![1]
        const [kind, owner, id] = a.split(':')
        if (kind !== '30617') return undefined

        const relays = a[2] ? [a[2]] : []
        return {
          owner,
          id,
          relays,
          get guid() {
            return owner + '/' + id
          },
          get naddr() {
            return naddrEncode({
              identifier: this.id,
              pubkey: this.owner,
              kind: 30617,
              relays
            })
          }
        }
      } catch (err) {
        return undefined
      }
    },
    get nevent() {
      return neventEncode({
        id: this.event.id,
        relays: this.sourceRelays,
        author: this.event.pubkey,
        kind: this.event.kind
      })
    }
  } as Patch
}

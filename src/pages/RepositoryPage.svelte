<script lang="ts">
  import {afterUpdate, onMount} from 'svelte'
  import {parsePatch, type Patch, type Repo} from '../lib/nip34.ts'

  import {pool, patchCache} from '../lib/nostr.ts'
  import UserLabel from '../components/UserLabel.svelte'
  import Header from '../components/Header.svelte'
  import type {Subscription} from 'nostr-tools/abstract-relay'
  import PatchItem from '../components/PatchItem.svelte'

  export let repo: Repo
  let current: Repo | undefined

  let patches: Patch[] = []
  let sub: Subscription
  let eoseHappened = false

  onMount(() => {
    return unloadPatches
  })

  afterUpdate(() => {
    if (current?.guid !== repo.guid) {
      current = repo
      unloadPatches()
      loadPatches()
    }
  })

  function unloadPatches() {
    if (sub) sub.close()
    eoseHappened = false
    patches = []
  }

  async function loadPatches() {
    pool.subscribeMany(
      repo.relays,
      [{kinds: [1617], '#a': [`30617:${repo.event.pubkey}:${repo.id}`]}],
      {
        onevent(evt) {
          let patch = parsePatch(evt)
          if (patch) {
            if (eoseHappened) {
              patches = [patch, ...patches]
            } else {
              patches.push(patch)
            }
            patchCache.set(evt.id, patch)
          }
        },
        oneose() {
          eoseHappened = true
          patches.sort((a, b) => b.event.created_at - a.event.created_at)
          patches = patches.map(patch => {
            patch.sourceRelays = Array.from(
              pool.seenOn.get(patch.event.id)?.values?.() || []
            ).map(r => r.url)
            return patch
          })
        },
        onclose(reason) {
          console.warn('subscription closed', reason)
        }
      }
    )
  }
</script>

<header class="pb-3 bg-white">
  <Header />
</header>
<main class="p-8 max-w-8xl">
  <div class="flex justify-between bg-emerald-300 py-2 px-8 rounded">
    <div>{repo.id}</div>
    <UserLabel withLink pubkey={repo.event.pubkey} />
  </div>
  <div class="grid grid-flow-col auto-cols-auto mt-4">
    <section class="bg-sky-200 mt-2 py-2 px-4 rounded">
      <h2 class="text-2xl px-4 py-2 text-center">info</h2>
      {#if repo.description}<div>{repo.description}</div>{/if}
      <div class="mt-2">clone</div>
      <div class="ml-2 flex flex-col">
        {#each repo.clone as url}
          <div class="mr-2">
            {url}
          </div>
        {/each}
      </div>
      <div class="mt-2">browse</div>
      <div class="ml-2 flex flex-col">
        {#each repo.web as url}
          <div class="mr-2">
            <a class="cursor-pointer hover:underline" href={url}>{url}</a>
          </div>
        {/each}
      </div>
      <div class="mt-2">relays</div>
      <div class="ml-2 flex flex-col">
        {#each repo.relays as url}
          <div class="mr-2">
            {url}
          </div>
        {/each}
      </div>
      <div class="ml-2 flex flex-wrap">
        {#each repo.event.tags.filter(t => t[0] === 't') as tag}
          <div class="mr-2">
            #{tag[1]}
          </div>
        {/each}
      </div>
    </section>
    <section class="bg-amber-200 mt-2 ml-8 p-2 px-4 rounded">
      <h2 class="text-2xl px-4 py-2 text-center">patches</h2>
      {#each patches as patch (patch.event.id)}
        <PatchItem {patch} />
      {/each}
    </section>
  </div>
</main>

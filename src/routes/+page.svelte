<script lang="ts">
  import {onMount} from 'svelte'
  import {parsePatch, parseRepo, type Patch, type Repo} from '../lib/nip34.ts'

  import Header from '../components/Header.svelte'
  import UserLabel from '../components/UserLabel.svelte'
  import {pool, repositoryRelays, repoCache, patchCache} from '../lib/nostr.ts'
  import PatchItem from '../components/PatchItem.svelte'

  let repos: Repo[] = []
  let patches: Patch[] = []
  let eoseHappened = false

  onMount(() => {
    repos = Array.from(repoCache.values())

    pool.subscribeMany(
      repositoryRelays,
      [
        {
          kinds: [30617, 1617],
          limit: 200
        }
      ],
      {
        onevent(evt) {
          switch (evt.kind) {
            case 30617:
              let repo = parseRepo(evt)
              let idx = repos.findIndex(
                r => r.id === repo.id && r.event.pubkey === repo.event.pubkey
              )

              if (idx === -1) {
                repos.unshift(repo)
              } else if (repo.event.created_at > repos[idx].event.created_at) {
                repos[idx] = repo
              } else return

              repoCache.set(repo.guid, repo)
              if (eoseHappened) {
                repos = repos
              }

              break
            case 1617:
              let patch = parsePatch(evt)
              if (patch) {
                if (eoseHappened) {
                  patches = [patch, ...patches]
                } else {
                  patches.push(patch)
                }
                patchCache.set(evt.id, patch)
              }
              break
          }
        },
        oneose() {
          eoseHappened = true
          repos.sort((a, b) => b.event.created_at - a.event.created_at)
          repos = repos

          patches.sort((a, b) => b.event.created_at - a.event.created_at)
          patches = patches.map(patch => {
            patch.sourceRelays = Array.from(
              pool.seenOn.get(patch.event.id)?.values?.() || []
            ).map(r => r.url)
            return patch
          })
        }
      }
    )
  })
</script>

<h1 class="text-2xl">
  <Header />
</h1>
<div class="m-8 max-w-8xl grid grid-flow-col auto-cols-auto gap-8">
  <div class="bg-orange-100 py-2 px-4 rounded">
    <h2 class="text-2xl px-4 py-2 text-center">latest repositories</h2>
    {#each repos as repo (repo.guid)}
      <div class="flex items-center mb-1">
        <a
          class="text-sky-700 hover:underline cursor-pointer"
          href={`/${repo.naddr}`}
        >
          {repo.id}
        </a>
        <span class="mx-2">by</span>
        <UserLabel withLink withPicture pubkey={repo.event.pubkey} />
      </div>
    {/each}
  </div>
  <div class="bg-amber-200 py-2 px-4 rounded">
    <h2 class="text-2xl px-4 py-2 text-center">latest patches</h2>
    {#each patches as patch (patch.event.id)}
      <div>
        <PatchItem {patch} withRepo />
      </div>
    {/each}
  </div>
</div>

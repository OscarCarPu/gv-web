<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';

  let { children } = $props();

  const navLinks = [
    { href: '/', label: 'Today' },
    { href: '/habits', label: 'All Habits' }
  ];
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
  />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <nav class="bg-white shadow sticky top-0 z-10">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-14">
        <a href="/" class="text-xl font-bold text-blue-500">Gestor Vida</a>

        <div class="flex items-center gap-1">
          {#each navLinks as link}
            <a
              href={link.href}
              class="px-3 py-2 rounded-lg text-sm font-medium transition-colors {$page.url
                .pathname === link.href
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'}"
            >
              {link.label}
            </a>
          {/each}
        </div>
      </div>
    </div>
  </nav>

  <main class="container mx-auto px-4 py-6">
    {@render children()}
  </main>
</div>

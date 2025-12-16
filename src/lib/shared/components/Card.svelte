<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    padding?: 'none' | 'sm' | 'md' | 'lg';
    children: Snippet;
  }

  let { padding = 'md', children }: Props = $props();

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };
</script>

<div class="bg-white rounded-lg shadow-md {paddingClasses[padding]}">
  {@render children()}
</div>

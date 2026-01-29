<svelte:head>
	<title>Archive - C!mail</title>
</svelte:head>

<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Sidebar, Header, EmailList } from '$lib';

	let { data } = $props();
	let q = $state('');
	let selectedIds = $state<Set<string>>(new Set());
	let actionLoading = $state(false);

	$effect(() => {
		q = data.q ?? '';
	});

	const buildAccountHref = (account: string) => {
		const params = new URLSearchParams();
		params.set('account', account);
		if (q.trim()) params.set('q', q.trim());
		return `/archive?${params.toString()}`;
	};

	const handleSearch = (query: string) => {
		goto(buildAccountHref(data.selectedAccount ?? 'all'));
	};

	const toggleRow = (id: string) => {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	};

	const bulkAction = async (action: string) => {
		if (selectedIds.size === 0 || actionLoading) return;
		actionLoading = true;
		try {
			for (const messageId of selectedIds) {
				await fetch('/api/actions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ messageId, action })
				});
			}
			selectedIds = new Set();
			await invalidateAll();
		} catch (e) {
			console.error('Bulk action failed:', e);
		} finally {
			actionLoading = false;
		}
	};
</script>

<div class="bg-background-light dark:bg-background-dark text-gray-900 dark:text-white overflow-hidden h-screen flex flex-col font-display">
	<Header 
		searchPlaceholder="Search archive..."
		searchValue={q}
		onSearch={handleSearch}
		activePage="archive"
		meAddress={data.meAddress}
		noreplyAddress={data.noreplyAddress}
	/>

	<div class="flex flex-1 overflow-hidden">
		<div class="hidden md:flex">
			<Sidebar
				meAddress={data.meAddress}
				noreplyAddress={data.noreplyAddress}
				selectedAccount={data.selectedAccount}
				activePage="archive"
				buildAccountHref={buildAccountHref}
			/>
		</div>

		<main class="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f1115]">
			<!-- Toolbar -->
			<div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-border-dark shrink-0 h-14 bg-white dark:bg-[#111318]">
				<div class="flex items-center gap-4">
					<span class="material-symbols-outlined text-gray-500">inventory_2</span>
					<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Archive</h1>
				</div>
				<div class="flex items-center gap-4">
					{#if selectedIds.size > 0}
						<button
							class="text-sm text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50"
							type="button"
							disabled={actionLoading}
							onclick={() => bulkAction('unarchive')}
						>
							Move to Inbox
						</button>
					{/if}
					<span class="text-sm text-gray-500 dark:text-gray-400">
						{data.totalCount ?? 0} items
					</span>
				</div>
			</div>

			{#if data.error}
				<div class="px-4 py-6 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
					<span class="material-symbols-outlined text-[18px] mr-2 align-middle">error</span>
					{data.error}
				</div>
			{/if}

			<EmailList
				messages={data.messages ?? []}
				emptyMessage="No archived messages."
				{selectedIds}
				onToggleSelect={toggleRow}
				fromFolder="archive"
			/>
		</main>
	</div>
</div>

<svelte:head>
	<title>Inbox - C!mail</title>
</svelte:head>

<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { Sidebar, Header, EmailList } from '$lib';

	let { data } = $props();
	let syncing = $state(false);
	let q = $state('');
	let selectedIds = $state<Set<string>>(new Set());
	let syncInterval: ReturnType<typeof setInterval> | undefined;
	let actionLoading = $state(false);

	$effect(() => {
		q = data.q ?? '';
	});

	const rowId = (m: any) => String(m.gmail_message_id ?? m.gmail_thread_id ?? '');
	const allVisibleIds = () => (data.messages ?? []).map(rowId).filter(Boolean);

	const toggleSelectAll = () => {
		const ids = allVisibleIds();
		if (ids.length === 0) return;
		if (ids.every((id) => selectedIds.has(id))) {
			selectedIds = new Set();
			return;
		}
		selectedIds = new Set(ids);
	};

	const toggleRow = (id: string) => {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	};

	const buildAccountHref = (account: string, searchQuery?: string, pageNum?: number) => {
		const params = new URLSearchParams();
		params.set('account', account);
		const qVal = searchQuery ?? q;
		if (qVal.trim()) params.set('q', qVal.trim());
		if (pageNum && pageNum > 1) params.set('page', String(pageNum));
		return `/inbox?${params.toString()}`;
	};

	const handleSearch = (query: string) => {
		const params = new URLSearchParams();
		params.set('account', data.selectedAccount ?? 'me');
		if (query.trim()) params.set('q', query.trim());
		goto(`/inbox?${params.toString()}`);
	};

	const goToPage = (pageNum: number) => {
		goto(buildAccountHref(data.selectedAccount ?? 'me', q, pageNum));
	};

	const currentPage = () => data.page ?? 1;
	const pageSize = () => data.pageSize ?? 50;
	const totalPages = () => Math.ceil((data.totalCount ?? 0) / pageSize());
	const hasPrevPage = () => currentPage() > 1;
	const hasNextPage = () => currentPage() < totalPages();
	const startItem = () => (currentPage() - 1) * pageSize() + 1;
	const endItem = () => Math.min(currentPage() * pageSize(), data.totalCount ?? 0);

	const syncNow = async () => {
		if (syncing) return;
		syncing = true;
		try {
			const res = await fetch('/api/sync', { method: 'POST' });
			if (res.ok) {
				await invalidateAll();
			}
		} catch (e) {
			console.error('Sync failed:', e);
		} finally {
			syncing = false;
		}
	};

	// Bulk action for selected messages
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

	// Auto-sync every 60 seconds
	onMount(() => {
		// Initial sync on page load
		syncNow();
		
		syncInterval = setInterval(() => {
			if (!syncing) {
				syncNow();
			}
		}, 60000);
	});

	onDestroy(() => {
		if (syncInterval) {
			clearInterval(syncInterval);
		}
	});
</script>

<div class="bg-background-light dark:bg-background-dark text-gray-900 dark:text-white overflow-hidden h-screen flex flex-col font-display">
	<Header 
		searchPlaceholder="Search inbox..."
		searchValue={q}
		onSearch={handleSearch}
		activePage="inbox"
		meAddress={data.meAddress}
		noreplyAddress={data.noreplyAddress}
	/>

	<div class="flex flex-1 overflow-hidden">
		<div class="hidden md:flex">
			<Sidebar
				meAddress={data.meAddress}
				noreplyAddress={data.noreplyAddress}
				selectedAccount={data.selectedAccount}
				activePage="inbox"
				buildAccountHref={buildAccountHref}
			/>
		</div>

		<main class="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f1115]">
			<!-- Toolbar -->
			<div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-border-dark shrink-0 h-14 bg-white dark:bg-[#111318]">
				<div class="flex items-center gap-2">
					<div class="flex items-center px-2">
						<input
							class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary dark:bg-[#282e39] dark:border-gray-600 cursor-pointer"
							type="checkbox"
							checked={allVisibleIds().length > 0 && allVisibleIds().every((id) => selectedIds.has(id))}
							onchange={toggleSelectAll}
						/>
					</div>
					<button
						class="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#282e39] rounded-lg disabled:opacity-50 transition-colors md:hidden"
						title="Refresh"
						disabled={syncing}
						onclick={syncNow}
					>
						<span class="material-symbols-outlined text-[20px] {syncing ? 'animate-spin' : ''}">refresh</span>
					</button>
					<button 
						class="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#282e39] rounded-lg transition-colors disabled:opacity-50" 
						title="Archive selected"
						disabled={selectedIds.size === 0 || actionLoading}
						onclick={() => bulkAction('archive')}
					>
						<span class="material-symbols-outlined text-[20px]">archive</span>
					</button>
					<button 
						class="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#282e39] rounded-lg transition-colors disabled:opacity-50" 
						title="Delete selected"
						disabled={selectedIds.size === 0 || actionLoading}
						onclick={() => bulkAction('trash')}
					>
						<span class="material-symbols-outlined text-[20px]">delete</span>
					</button>
					<button 
						class="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#282e39] rounded-lg transition-colors disabled:opacity-50" 
						title="Mark selected as read"
						disabled={selectedIds.size === 0 || actionLoading}
						onclick={() => bulkAction('markRead')}
					>
						<span class="material-symbols-outlined text-[20px]">mark_email_read</span>
					</button>
				</div>
				<div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
					<span>{startItem()}-{endItem()} of {data.totalCount ?? 0}</span>
					<div class="flex items-center">
						<button 
							class="p-2 hover:bg-gray-100 dark:hover:bg-[#282e39] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
							disabled={!hasPrevPage()}
							onclick={() => goToPage(currentPage() - 1)}
							type="button"
						>
							<span class="material-symbols-outlined text-[20px]">chevron_left</span>
						</button>
						<button 
							class="p-2 hover:bg-gray-100 dark:hover:bg-[#282e39] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
							disabled={!hasNextPage()}
							onclick={() => goToPage(currentPage() + 1)}
							type="button"
						>
							<span class="material-symbols-outlined text-[20px]">chevron_right</span>
						</button>
					</div>
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
				emptyMessage="No emails yet. Click refresh to sync from Gmail."
				{selectedIds}
				onToggleSelect={toggleRow}
				onToggleAll={toggleSelectAll}
				fromFolder="inbox"
			/>
		</main>
	</div>
</div>

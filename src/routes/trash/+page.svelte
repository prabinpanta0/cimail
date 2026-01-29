<svelte:head>
	<title>Trash - C!mail</title>
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
		return `/trash?${params.toString()}`;
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

	const emptyTrash = async () => {
		if (!confirm('Permanently delete all messages in Trash?')) return;
		actionLoading = true;
		try {
			for (const m of data.messages ?? []) {
				await fetch('/api/actions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ messageId: m.gmail_message_id, action: 'delete' })
				});
			}
			await invalidateAll();
		} catch (e) {
			console.error('Empty trash failed:', e);
		} finally {
			actionLoading = false;
		}
	};
</script>

<div class="bg-background-light dark:bg-background-dark text-gray-900 dark:text-white overflow-hidden h-screen flex flex-col font-display">
	<Header 
		searchPlaceholder="Search trash..."
		searchValue={q}
		onSearch={handleSearch}
		activePage="trash"
		meAddress={data.meAddress}
		noreplyAddress={data.noreplyAddress}
	/>

	<div class="flex flex-1 overflow-hidden">
		<div class="hidden md:flex">
			<Sidebar
				meAddress={data.meAddress}
				noreplyAddress={data.noreplyAddress}
				selectedAccount={data.selectedAccount}
				activePage="trash"
				buildAccountHref={buildAccountHref}
			/>
		</div>

		<main class="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f1115]">
			<!-- Toolbar -->
			<div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-border-dark shrink-0 h-14 bg-white dark:bg-[#111318]">
				<div class="flex items-center gap-4">
					<span class="material-symbols-outlined text-gray-500">delete</span>
					<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Trash</h1>
				</div>
				<div class="flex items-center gap-4">
					{#if selectedIds.size > 0}
						<button
							class="text-sm text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50"
							type="button"
							disabled={actionLoading}
							onclick={() => bulkAction('untrash')}
						>
							Move to Inbox
						</button>
						<button
							class="text-sm text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
							type="button"
							disabled={actionLoading}
							onclick={() => bulkAction('delete')}
						>
							Delete Forever
						</button>
					{:else if (data.totalCount ?? 0) > 0}
						<button
							class="text-sm text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
							type="button"
							disabled={actionLoading}
							onclick={emptyTrash}
						>
							Empty trash now
						</button>
					{/if}
					<span class="text-sm text-gray-500 dark:text-gray-400">
						{data.totalCount ?? 0} items
					</span>
				</div>
			</div>

			{#if (data.totalCount ?? 0) > 0}
				<div class="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-300">
					<span class="material-symbols-outlined text-[18px] mr-2 align-middle">info</span>
					Messages in Trash are automatically deleted after 30 days.
				</div>
			{/if}

			{#if data.error}
				<div class="px-4 py-6 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
					<span class="material-symbols-outlined text-[18px] mr-2 align-middle">error</span>
					{data.error}
				</div>
			{/if}

			<EmailList
				messages={data.messages ?? []}
				emptyMessage="Trash is empty."
				{selectedIds}
				onToggleSelect={toggleRow}
				fromFolder="trash"
			/>
		</main>
	</div>
</div>

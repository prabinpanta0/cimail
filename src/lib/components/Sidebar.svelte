<script lang="ts">
	interface Props {
		meAddress: string;
		noreplyAddress: string;
		selectedAccount?: string;
		activePage?: 'inbox' | 'sent' | 'starred' | 'drafts' | 'trash' | 'archive' | 'compose' | 'thread';
		showAccountFilter?: boolean;
		buildAccountHref?: (account: string) => string;
	}

	let {
		meAddress,
		noreplyAddress,
		selectedAccount = 'me',
		activePage = 'inbox',
		showAccountFilter = true,
		buildAccountHref = (account: string) => `/inbox?account=${account}`
	}: Props = $props();
</script>

<aside class="w-64 flex-shrink-0 flex flex-col bg-gray-50 dark:bg-[#111318] border-r border-gray-200 dark:border-border-dark">


	<!-- Compose Button -->
	<div class="px-3 py-2">
		<a
			href="/compose"
			class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl h-12 px-4 bg-primary hover:bg-blue-600 shadow-lg shadow-primary/20 text-white transition-all transform hover:scale-[1.02] active:scale-[0.98]"
		>
			<span class="material-symbols-outlined text-[20px]">edit</span>
			<span class="text-sm font-bold tracking-wide">Compose</span>
		</a>
	</div>

	<!-- Navigation -->
	<nav class="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
		<div class="px-3 py-2">
			<p class="text-gray-500 dark:text-[#9da6b9] text-xs font-bold uppercase tracking-wider mb-2">Folders</p>
		</div>

		<a
			class={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1 ${activePage === 'inbox' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
			href="/inbox"
		>
			<span class={activePage === 'inbox' ? 'material-symbols-filled' : 'material-symbols-outlined'}>inbox</span>
			<span class="flex-1">Inbox</span>
		</a>

		<a
			class={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1 ${activePage === 'starred' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
			href="/starred"
		>
			<span class={activePage === 'starred' ? 'material-symbols-filled' : 'material-symbols-outlined'}>star</span>
			<span class="flex-1">Starred</span>
		</a>

		<a
			class={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1 ${activePage === 'sent' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
			href="/sent"
		>
			<span class={activePage === 'sent' ? 'material-symbols-filled' : 'material-symbols-outlined'}>send</span>
			<span class="flex-1">Sent</span>
		</a>

		<a
			class={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1 ${activePage === 'drafts' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
			href="/drafts"
		>
			<span class={activePage === 'drafts' ? 'material-symbols-filled' : 'material-symbols-outlined'}>draft</span>
			<span class="flex-1">Drafts</span>
		</a>

		<a
			class={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1 ${activePage === 'archive' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
			href="/archive"
		>
			<span class={activePage === 'archive' ? 'material-symbols-filled' : 'material-symbols-outlined'}>inventory_2</span>
			<span class="flex-1">Archive</span>
		</a>

		<a
			class={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1 ${activePage === 'trash' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
			href="/trash"
		>
			<span class={activePage === 'trash' ? 'material-symbols-filled' : 'material-symbols-outlined'}>delete</span>
			<span class="flex-1">Trash</span>
		</a>

		{#if showAccountFilter}
			<div class="my-3 h-px bg-gray-200 dark:bg-border-dark mx-3"></div>

			<div class="px-3 py-2">
				<p class="text-gray-500 dark:text-[#9da6b9] text-xs font-bold uppercase tracking-wider mb-2">Accounts</p>
			</div>

			<a
				href={buildAccountHref('me')}
				class={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 border transition-colors ${selectedAccount === 'me' ? 'text-gray-900 dark:text-white bg-gray-200 dark:bg-[#282e39]/50 border-gray-300 dark:border-transparent' : 'text-gray-600 dark:text-[#9da6b9] border-transparent hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
			>
				<div class="size-2 rounded-full bg-green-500"></div>
				<span class="flex-1 text-sm truncate">{meAddress}</span>
			</a>

			<a
				href={buildAccountHref('noreply')}
				class={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 border transition-colors ${selectedAccount === 'noreply' ? 'text-gray-900 dark:text-white bg-gray-200 dark:bg-[#282e39]/50 border-gray-300 dark:border-transparent' : 'text-gray-600 dark:text-[#9da6b9] border-transparent hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
			>
				<div class="size-2 rounded-full bg-gray-400"></div>
				<span class="flex-1 text-sm truncate">{noreplyAddress}</span>
			</a>

			<a
				href={buildAccountHref('all')}
				class={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 border transition-colors ${selectedAccount === 'all' ? 'text-gray-900 dark:text-white bg-gray-200 dark:bg-[#282e39]/50 border-gray-300 dark:border-transparent' : 'text-gray-600 dark:text-[#9da6b9] border-transparent hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
			>
				<div class="size-2 rounded-full bg-blue-500"></div>
				<span class="flex-1 text-sm truncate">All Accounts</span>
			</a>
		{/if}
	</nav>

</aside>

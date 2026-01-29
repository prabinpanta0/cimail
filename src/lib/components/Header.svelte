<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		searchPlaceholder?: string;
		searchValue?: string;
		onSearch?: (query: string) => void;
		meAddress?: string;
		noreplyAddress?: string;
		activePage?: 'inbox' | 'sent' | 'starred' | 'drafts' | 'trash' | 'compose' | 'thread' | 'archive';
	}

	let {
		searchPlaceholder = 'Search mail',
		searchValue = '',
		onSearch,
		meAddress = '',
		noreplyAddress = '',
		activePage = 'inbox'
	}: Props = $props();

	let q = $state('');
	let mobileMenuOpen = $state(false);
	let profileMenuOpen = $state(false);
	let syncing = $state(false);

	$effect(() => {
		q = searchValue;
	});

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			onSearch?.(q);
		}
	};

	const toggleMobileMenu = () => {
		mobileMenuOpen = !mobileMenuOpen;
	};

	const closeMobileMenu = () => {
		mobileMenuOpen = false;
	};

	const toggleProfileMenu = () => {
		profileMenuOpen = !profileMenuOpen;
	};

	const closeProfileMenu = () => {
		profileMenuOpen = false;
	};

	const handleLogout = () => {
		window.location.href = '/api/logout';
	};

	const handleSync = async () => {
		if (syncing) return;
		syncing = true;
		try {
			await fetch('/api/sync', { method: 'POST' });
			window.location.reload();
		} catch (e) {
			console.error('Sync failed:', e);
		} finally {
			syncing = false;
		}
	};

	const handleFullSync = async () => {
		try {
			const res = await fetch('/api/sync?full=true', { method: 'POST' });
			const data = await res.json();
			alert(`Full sync complete: ${data.upserted} messages synced`);
			window.location.reload();
		} catch (e) {
			alert('Sync failed');
		}
	};
</script>

<header class="flex items-center justify-between whitespace-nowrap border-b border-gray-200 dark:border-border-dark px-3 md:px-6 py-3 bg-white dark:bg-[#111318] shrink-0 z-20">
	<!-- Left side: Hamburger + Logo (visible on mobile) -->
	<div class="flex items-center gap-2 md:hidden">
		<button 
			class="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#282e39] transition-colors"
			onclick={toggleMobileMenu}
			type="button"
			aria-label="Toggle menu"
		>
			<span class="material-symbols-outlined text-[24px]">{mobileMenuOpen ? 'close' : 'menu'}</span>
		</button>
		<a class="flex items-center gap-2" href="/inbox">
			<img src="/logo.png" alt="C!mail" class="w-8 h-8 object-contain" />
			<h2 class="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-tight">C!mail</h2>
		</a>
	</div>

	<!-- Search Bar -->
	<div class="flex-1 max-w-2xl px-4 md:px-8">
		<label class="flex flex-col w-full h-11 relative group">
			<div class="flex w-full flex-1 items-stretch rounded-xl h-full bg-gray-100 dark:bg-[#282e39] transition-all group-focus-within:bg-white dark:group-focus-within:bg-[#1e232b] group-focus-within:shadow-md group-focus-within:ring-1 ring-primary/20">
				<div class="text-gray-500 dark:text-[#9da6b9] flex border-none items-center justify-center pl-4 rounded-l-xl">
					<span class="material-symbols-outlined">search</span>
				</div>
				<input
					class="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-gray-900 dark:text-white focus:outline-0 border-none bg-transparent h-full placeholder:text-gray-500 dark:placeholder:text-[#9da6b9] px-4 pl-2 text-base font-normal leading-normal"
					placeholder={searchPlaceholder}
					bind:value={q}
					onkeydown={handleKeydown}
				/>
				<button
					class="text-gray-500 dark:text-[#9da6b9] flex border-none items-center justify-center px-3 rounded-r-xl hover:text-primary disabled:opacity-50 transition-colors"
					title="Sync emails"
					disabled={syncing}
					onclick={handleSync}
					type="button"
				>
					<span class="material-symbols-outlined {syncing ? 'animate-spin' : ''}">refresh</span>
				</button>
			</div>
		</label>
	</div>

	<!-- Right side actions -->
	<div class="flex items-center gap-4 md:gap-6">
		<!-- Profile Menu -->
		<div class="relative">
			<button 
				class="rounded-full size-10 border-2 border-transparent hover:border-primary cursor-pointer transition-all overflow-hidden"
				onclick={toggleProfileMenu}
				type="button"
			>
				<img class="w-full h-full object-cover" src="/logo.png" alt="Profile" />
			</button>
			
			{#if profileMenuOpen}
				<button 
					class="fixed inset-0 z-40"
					onclick={closeProfileMenu}
					type="button"
					aria-label="Close menu"
				></button>
				<div class="absolute right-0 top-12 w-56 bg-white dark:bg-[#1e232b] rounded-lg shadow-xl border border-gray-200 dark:border-border-dark z-50 py-2">
					<div class="px-4 py-2 border-b border-gray-200 dark:border-border-dark">
						<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{meAddress || 'User'}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">Primary Account</p>
					</div>
					<button 
						class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282e39] transition-colors"
						onclick={handleFullSync}
						type="button"
					>
						<span class="material-symbols-outlined text-[20px]">sync</span>
						Full Sync
					</button>
					<a 
						class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282e39] transition-colors"
						href="/auth/google/start"
						onclick={closeProfileMenu}
					>
						<span class="material-symbols-outlined text-[20px]">key</span>
						Re-authenticate
					</a>
					<div class="border-t border-gray-200 dark:border-border-dark my-1"></div>
					<button 
						class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
						onclick={handleLogout}
						type="button"
					>
						<span class="material-symbols-outlined text-[20px]">logout</span>
						Sign out
					</button>
				</div>
			{/if}
		</div>
	</div>
</header>

<!-- Mobile Menu Overlay -->
{#if mobileMenuOpen}
	<!-- Backdrop -->
	<button 
		class="fixed inset-0 bg-black/50 z-40 md:hidden"
		onclick={closeMobileMenu}
		type="button"
		aria-label="Close menu"
	></button>
	
	<!-- Mobile Sidebar -->
	<aside class="fixed top-0 left-0 w-72 h-full bg-gray-50 dark:bg-[#111318] z-50 md:hidden shadow-xl overflow-y-auto">
		<!-- Close Button -->
		<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-border-dark">
			<a class="flex items-center gap-2" href="/inbox" onclick={closeMobileMenu}>
				<img src="/logo.png" alt="C!mail" class="w-8 h-8 object-contain" />
				<h2 class="text-gray-900 dark:text-white text-lg font-bold">C!mail</h2>
			</a>
			<button 
				class="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#282e39]"
				onclick={closeMobileMenu}
				type="button"
			>
				<span class="material-symbols-outlined">close</span>
			</button>
		</div>
		
		<!-- Compose Button -->
		<div class="px-3 py-4">
			<a
				href="/compose"
				onclick={closeMobileMenu}
				class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl h-12 px-4 bg-primary hover:bg-blue-600 shadow-lg shadow-primary/20 text-white transition-all"
			>
				<span class="material-symbols-outlined text-[20px]">edit</span>
				<span class="text-sm font-bold tracking-wide">Compose</span>
			</a>
		</div>
		
		<!-- Navigation -->
		<nav class="px-3 py-2 flex flex-col gap-1">
			<p class="px-3 py-2 text-gray-500 dark:text-[#9da6b9] text-xs font-bold uppercase tracking-wider">Folders</p>
			
			<a
				class={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${activePage === 'inbox' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
				href="/inbox"
				onclick={closeMobileMenu}
			>
				<span class={activePage === 'inbox' ? 'material-symbols-filled' : 'material-symbols-outlined'}>inbox</span>
				<span>Inbox</span>
			</a>

			<a
				class={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${activePage === 'starred' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
				href="/starred"
				onclick={closeMobileMenu}
			>
				<span class={activePage === 'starred' ? 'material-symbols-filled' : 'material-symbols-outlined'}>star</span>
				<span>Starred</span>
			</a>

			<a
				class={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${activePage === 'sent' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
				href="/sent"
				onclick={closeMobileMenu}
			>
				<span class={activePage === 'sent' ? 'material-symbols-filled' : 'material-symbols-outlined'}>send</span>
				<span>Sent</span>
			</a>

			<a
				class={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${activePage === 'drafts' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
				href="/drafts"
				onclick={closeMobileMenu}
			>
				<span class={activePage === 'drafts' ? 'material-symbols-filled' : 'material-symbols-outlined'}>draft</span>
				<span>Drafts</span>
			</a>

			<a
				class={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${activePage === 'trash' ? 'bg-primary/15 text-primary dark:text-white font-medium' : 'text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]'}`}
				href="/trash"
				onclick={closeMobileMenu}
			>
				<span class={activePage === 'trash' ? 'material-symbols-filled' : 'material-symbols-outlined'}>delete</span>
				<span>Trash</span>
			</a>
			
			<div class="my-3 h-px bg-gray-200 dark:bg-border-dark mx-3"></div>
			
			<button
				class="flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39] w-full"
				onclick={handleFullSync}
				type="button"
			>
				<span class="material-symbols-outlined">sync</span>
				<span>Full Sync</span>
			</button>
			
			<a
				class="flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-gray-600 dark:text-[#9da6b9] hover:bg-gray-200 dark:hover:bg-[#282e39]"
				href="/auth/google/start"
				onclick={closeMobileMenu}
			>
				<span class="material-symbols-outlined">key</span>
				<span>Re-authenticate</span>
			</a>
			
			<button
				class="flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
				onclick={handleLogout}
				type="button"
			>
				<span class="material-symbols-outlined">logout</span>
				<span>Sign out</span>
			</button>
		</nav>
	</aside>
{/if}

<svelte:head>
	<title>Login</title>
</svelte:head>

<div class="min-h-screen bg-background-light dark:bg-background-dark text-gray-900 dark:text-white font-display flex items-center justify-center p-6">
	<div class="w-full max-w-md bg-white dark:bg-[#111318] border border-gray-200 dark:border-border-dark rounded-xl shadow-xl p-6">
		<h1 class="text-xl font-bold">Sign in</h1>
		<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
			This app is restricted to the owner Google account.
		</p>
		<a
			href="/auth/google/start"
			class="mt-6 flex items-center justify-center gap-3 rounded-xl h-12 px-6 bg-primary hover:bg-blue-600 text-white font-bold transition-colors"
		>
			<span class="material-symbols-outlined text-[20px]">login</span>
			<span>Continue with Google</span>
		</a>
		<p class="text-xs text-gray-500 dark:text-gray-400 mt-4">
			If you see “restricted to the owner account”, you logged in with a different Google user.
		</p>
	</div>
</div>

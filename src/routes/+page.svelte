<script lang="ts">
	import '$styles/welcome.css';
	import Icon from '$lib/shared/components/Icon.svelte';

	let { data } = $props();

	const projects = [
		{
			name: 'central-pipeline',
			description: 'Central IoT data pipeline — Go MQTT consumer + dbt on Postgres, medallion architecture (bronze → silver → gold).',
			language: 'Go · dbt',
			url: 'https://git.lab-ocp.com/ocp/central-pipeline'
		},
		{
			name: 'mutual-watchdog',
			description: 'Mutual watchdog between a home lab (Go) and an external node to detect outages.',
			language: 'Rust',
			url: 'https://git.lab-ocp.com/ocp/mutual-watchdog'
		},
		{
			name: 'gv-api',
			description: 'Go REST API powering this app — habits, tasks, time tracking, finance and more.',
			language: 'Go',
			url: 'https://git.lab-ocp.com/ocp/gv-api'
		}
	];

	const skills = ['Python', 'Django REST', 'FastAPI', 'Apache Airflow', 'Data pipelines', 'Algorithms', 'Competitive Programming'];
	const languages = [
		{ name: 'Spanish', level: 'Native' },
		{ name: 'Galician', level: 'Native' },
		{ name: 'English', level: 'C1 Proficient' },
		{ name: 'Catalan', level: 'Basic' }
	];
	const certifications = [
		{ name: 'PCPP1 – Certified Professional in Python', issuer: 'Python Institute · 09/2025' },
		{ name: 'AWS Certified Developer – Associate', issuer: 'AWS · 02/2025' }
	];
	const awards = [
		{ name: '2× Bronze — Spanish Olympiad of Informatics (OIE)', date: '2021 / 2022' },
		{ name: '2× Winner — Galician Olympiad of Informatics (OIG)', date: '2021 / 2022' }
	];
</script>

<div class="welcome-page">
	<div class="welcome-content">
		<div class="welcome-hero">
			<img src="/perfil.jpeg" alt="Oscar Carballo" class="welcome-avatar" />
			<div class="welcome-hero-text">
			<h1>Oscar Carballo Puebla</h1>
			<p class="welcome-tagline">Backend Developer · Data pipelines · Big Data</p>
			<div class="welcome-hero-links">
				<a href="https://git.lab-ocp.com/explore/repos" target="_blank" rel="noopener noreferrer" class="hero-link">
					<Icon name="folder" />
					Gitea
				</a>
				<a href="https://www.linkedin.com/in/oscar-carballo-puebla/" target="_blank" rel="noopener noreferrer" class="hero-link">
					<Icon name="arrow-trend-up" />
					LinkedIn
				</a>
				<a href="/CV.pdf" download="Oscar_Carballo_CV.pdf" class="hero-link">
					<Icon name="arrow-up" class="rotate-down" />
					CV
				</a>
			</div>
			</div>
		</div>

		<div class="welcome-section">
			<h2>About</h2>
			<p>
				Hello! I'm Oscar Carballo, a Backend Developer specializing in scalable solutions with Django
				REST Framework. I have hands-on experience building robust data pipelines using FastAPI, Flask,
				and Airflow, and working with protocols and libraries such as MQTT, ZeroMQ, Kafka, and Pandas.
			</p>
			<p class="mt">
				Currently pursuing a Data Science degree at UOC, I'm steering my career toward Big Data and
				systems engineering. I'm driven by the challenge of bridging data processing with low-level
				optimization — building infrastructure that is efficient, reliable, and maintainable.
			</p>
			<p class="mt">
				Beyond my core stack, I actively explore Go, Rust, and IoT, and I'm passionate about
				automating both my workflows and everyday processes.
			</p>
		</div>

		<div class="welcome-section">
			<h2>Skills</h2>
			<div class="skill-chips">
				{#each skills as skill}
					<span class="skill-chip">{skill}</span>
				{/each}
			</div>
			<div class="lang-chips">
				{#each languages as lang}
					<span class="lang-chip"><span class="lang-name">{lang.name}</span> {lang.level}</span>
				{/each}
			</div>
		</div>

		<div class="welcome-section">
			<h2>Certifications &amp; Awards</h2>
			<div class="welcome-cards">
				{#each certifications as cert}
					<div class="welcome-card">
						<div class="welcome-card-title">{cert.name}</div>
						<div class="welcome-card-sub">{cert.issuer}</div>
					</div>
				{/each}
				{#each awards as award}
					<div class="welcome-card">
						<div class="welcome-card-title">{award.name}</div>
						<div class="welcome-card-sub">{award.date}</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="welcome-section">
			<h2>Featured Projects</h2>
			<div class="project-grid">
				{#each projects as project}
					<a href={project.url} target="_blank" rel="noopener noreferrer" class="project-item">
						<div class="project-name">
							<Icon name="folder" />
							{project.name}
						</div>
						<div class="project-desc">{project.description}</div>
						<div class="project-lang"><span>{project.language}</span></div>
					</a>
				{/each}
			</div>
		</div>
	</div>
</div>

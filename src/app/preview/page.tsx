'use client';

export default function PreviewPage() {
  return (
    <>
      
{/* ==================== SHARED COMPONENT: SideNavBar ==================== */}
<aside className="fixed left-0 top-0 h-full w-64 flex flex-col justify-between p-4 z-40 bg-surface-container-lowest border-r border-outline-variant">
<div className="flex flex-col gap-6">
{/* Workspace Brand & Trip Header */}
<div className="flex items-center gap-3 px-2 pt-1 pb-2">
<div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary font-label-caps text-label-caps tracking-wider shadow-none">
          LS
        </div>
<div className="flex flex-col leading-none">
<span className="font-headline-sm text-headline-sm tracking-tight text-on-surface font-semibold">Ledger Sync</span>
<span className="font-body-sm text-body-sm text-secondary mt-1">Kyoto Retreat 2024</span>
</div>
</div>
{/* Primary Navigation Tabs (Active: Overview) */}
<nav aria-label="Main Navigation" className="flex flex-col gap-1">
{/* 1. Overview (Active Match) */}
<a className="flex items-center gap-3 px-3 py-2 bg-surface-container text-on-surface rounded font-medium border-l-2 border-primary" href="#overview">
<span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span className="font-body-md text-body-md">Overview</span>
</a>
{/* 2. Expenses */}
<a className="flex items-center gap-3 px-3 py-2 text-secondary rounded hover:bg-surface-container-low hover:text-on-surface transition-colors duration-150" href="#expenses">
<span className="material-symbols-outlined" data-icon="receipt_long">receipt_long</span>
<span className="font-body-md text-body-md">Expenses</span>
</a>
{/* 3. Members */}
<a className="flex items-center gap-3 px-3 py-2 text-secondary rounded hover:bg-surface-container-low hover:text-on-surface transition-colors duration-150" href="#members">
<span className="material-symbols-outlined" data-icon="group">group</span>
<span className="font-body-md text-body-md">Members</span>
</a>
{/* 4. Balances */}
<a className="flex items-center gap-3 px-3 py-2 text-secondary rounded hover:bg-surface-container-low hover:text-on-surface transition-colors duration-150" href="#balances">
<span className="material-symbols-outlined" data-icon="account_balance">account_balance</span>
<span className="font-body-md text-body-md">Balances</span>
</a>
{/* 5. Settings */}
<a className="flex items-center gap-3 px-3 py-2 text-secondary rounded hover:bg-surface-container-low hover:text-on-surface transition-colors duration-150" href="#settings">
<span className="material-symbols-outlined" data-icon="settings">settings</span>
<span className="font-body-md text-body-md">Settings</span>
</a>
</nav>
{/* Ledger Sync Quick Action */}
<div className="px-2 pt-2">
<button className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-surface-container-lowest border border-outline-variant hover:bg-surface-container-low text-on-surface rounded transition-colors text-body-sm font-body-md" type="button">
<span className="material-symbols-outlined text-[18px]" data-icon="file_download">file_download</span>
<span>Export Ledger</span>
</button>
</div>
</div>
{/* Sidebar Footer / Secondary Links & Status */}
<div className="flex flex-col gap-3 pt-4 border-t border-outline-variant">
<div className="flex flex-col gap-1">
<a className="flex items-center gap-3 px-3 py-1.5 text-secondary hover:text-on-surface rounded hover:bg-surface-container-low transition-colors duration-150" href="#docs">
<span className="material-symbols-outlined text-[18px]" data-icon="help_outline">help_outline</span>
<span className="font-body-sm text-body-sm">Documentation</span>
</a>
<a className="flex items-center gap-3 px-3 py-1.5 text-secondary hover:text-on-surface rounded hover:bg-surface-container-low transition-colors duration-150" href="#audit">
<span className="material-symbols-outlined text-[18px]" data-icon="history">history</span>
<span className="font-body-sm text-body-sm">Audit Log</span>
</a>
</div>
{/* Current User Micro-card */}
<div className="flex items-center gap-3 px-2 py-2 bg-surface-container-low rounded border border-outline-variant">
<div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-[12px] font-label-caps font-semibold">
          AM
        </div>
<div className="flex flex-col leading-none overflow-hidden">
<span className="font-body-sm text-body-sm font-medium text-on-surface truncate">Alex Morgan</span>
<span className="font-label-caps text-label-caps text-secondary mt-0.5">Admin • Organizer</span>
</div>
</div>
</div>
</aside>
{/* ==================== SHARED COMPONENT: TopNavBar ==================== */}
<header className="fixed top-0 left-64 right-0 h-16 px-gutter flex justify-between items-center z-30 bg-surface-container-lowest border-b border-outline-variant">
{/* Left Section: Search & Scope Switcher */}
<div className="flex items-center gap-4 w-1/2">
{/* Search Input (search_bar: on_left) */}
<div className="relative w-72">
<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]" data-icon="search">search</span>
<input className="w-full pl-9 pr-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:outline-none focus:border-primary transition-colors" placeholder="Filter expenses, notes, payees..." type="text"/>
</div>
<div className="h-4 w-[1px] bg-outline-variant"></div>
{/* Navigation links cluster / Trip Selector */}
<div className="flex items-center gap-2">
<button className="flex items-center gap-1.5 px-2.5 py-1 text-on-surface font-body-sm font-medium hover:bg-surface-container-low rounded transition-colors">
<span>Kyoto Autumn Retreat</span>
<span className="material-symbols-outlined text-[16px] text-secondary" data-icon="expand_more">expand_more</span>
</button>
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-secondary font-label-caps text-label-caps">
          Oct 18 - 26, 2024 • 6 Travelers
        </span>
</div>
</div>
{/* Right Section: Trailing Actions, Currency, Add Expense */}
<div className="flex items-center gap-3">
{/* Multi-currency rate badge */}
<div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-low border border-outline-variant rounded text-secondary font-label-numeric-sm text-label-numeric-sm">
<span className="font-medium text-on-surface">USD ($)</span>
<span className="text-outline">/</span>
<span className="text-secondary">152.4 JPY</span>
</div>
{/* Trailing Icon Actions */}
<button aria-label="Notifications" className="w-8 h-8 flex items-center justify-center rounded text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors" type="button">
<span className="material-symbols-outlined text-[20px]" data-icon="notifications">notifications</span>
</button>
<button aria-label="Tune View" className="w-8 h-8 flex items-center justify-center rounded text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors" type="button">
<span className="material-symbols-outlined text-[20px]" data-icon="tune">tune</span>
</button>
<div className="h-4 w-[1px] bg-outline-variant"></div>
{/* Primary Action: + Add Expense */}
<button className="flex items-center gap-1.5 px-4 h-9 bg-primary text-on-primary hover:bg-primary-container rounded font-body-sm text-body-sm font-medium tracking-tight shadow-none transition-colors active:scale-[0.99]" onClick={() => alert('Add Expense dialog modal triggers here.')} type="button">
<span className="material-symbols-outlined text-[18px]" data-icon="add">add</span>
<span>Add Expense</span>
</button>
{/* Profile Avatar */}
<div className="w-8 h-8 rounded-full border border-outline-variant overflow-hidden ml-1 flex-shrink-0 bg-surface-container flex items-center justify-center">
<img className="w-full h-full object-cover" data-alt="Monochromatic portrait avatar of financial administrator Alex Morgan in high contrast lighting, clean professional composition with minimalist slate studio background." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnmVjQC2MhWRFqVDe6bTeqHuxbsJz2X4yaX9PfibL7u6l7PGQ_qpM4qVTH-uCyDURIR-umw7vALt0s5S_ypgd2ax2SyaguKQixOOT8v-ggdfvCe8mOYtYuwM1nKS8ZRjPlqkYCZhP7EXRxwusM989uZdfcSHSNpk_PTbIVXVBRMuzjRU4Svn67wgTfUHy8c7o0YsroYMCYbKiqaBCk8cswBlu41mRKiliFfkALP0gW0xFXYC_ydzIBpy-FQjREpc2iQFT6-YDPIew"/>
</div>
</div>
</header>
{/* ==================== MAIN CONTENT CANVAS ==================== */}
<main className="ml-64 pt-16 min-h-screen bg-background pb-16">
<div className="max-w-[1280px] mx-auto px-gutter py-8 flex flex-col gap-8">
{/* Breadcrumb and Page Header Section */}
<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline-variant pb-6">
<div>
<div className="flex items-center gap-2 text-secondary font-label-caps text-label-caps uppercase mb-1.5">
<span>Workspaces</span>
<span>/</span>
<span>Trips</span>
<span>/</span>
<span className="text-on-surface font-semibold">Kyoto Autumn Retreat</span>
</div>
<h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Ledger Overview</h1>
<p className="font-body-md text-body-md text-secondary mt-1">Multi-party real-time balance resolution and settlement distribution engine.</p>
</div>
<div className="flex items-center gap-2">
<div className="flex items-center border border-outline-variant rounded bg-surface-container-lowest p-0.5">
<button className="px-3 py-1 font-label-caps text-label-caps bg-surface-container text-on-surface rounded font-medium">All Currencies</button>
<button className="px-3 py-1 font-label-caps text-label-caps text-secondary hover:text-on-surface transition-colors">USD Only</button>
<button className="px-3 py-1 font-label-caps text-label-caps text-secondary hover:text-on-surface transition-colors">JPY Only</button>
</div>
<button className="flex items-center gap-1 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-body-sm text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors">
<span className="material-symbols-outlined text-[16px]" data-icon="refresh">refresh</span>
<span>Auto-synced</span>
</button>
</div>
</div>
{/* ==================== TOP KPI METRIC CARDS ==================== */}
<section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
{/* Card 1: Total Trip Cost */}
<div className="p-5 bg-surface-container-lowest border border-outline-variant rounded flex flex-col justify-between">
<div className="flex items-center justify-between text-secondary">
<span className="font-label-caps text-label-caps uppercase">Total Trip Cost</span>
<span className="material-symbols-outlined text-[18px] text-outline" data-icon="payments">payments</span>
</div>
<div className="my-3">
<div className="font-label-numeric-lg text-headline-lg font-semibold text-on-surface tabular-nums tracking-tight">$11,480.00</div>
<div className="mt-2 w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{width: "82%"}}></div>
</div>
</div>
<div className="flex items-center justify-between font-label-numeric-sm text-label-numeric-sm text-secondary pt-1">
<span>Budget $14,000</span>
<span className="font-medium text-on-surface">82% utilized</span>
</div>
</div>
{/* Card 2: Your Expense Share */}
<div className="p-5 bg-surface-container-lowest border border-outline-variant rounded flex flex-col justify-between">
<div className="flex items-center justify-between text-secondary">
<span className="font-label-caps text-label-caps uppercase">Your Expense Share</span>
<span className="material-symbols-outlined text-[18px] text-outline" data-icon="pie_chart">pie_chart</span>
</div>
<div className="my-3">
<div className="font-label-numeric-lg text-headline-lg font-semibold text-on-surface tabular-nums tracking-tight">$1,913.33</div>
<div className="font-body-sm text-body-sm text-secondary mt-1">16.67% equal split ratio</div>
</div>
<div className="flex items-center gap-1.5 font-label-numeric-sm text-label-numeric-sm text-secondary border-t border-surface-container pt-2">
<span className="material-symbols-outlined text-[14px]" data-icon="receipt">receipt</span>
<span>Across 34 split transactions</span>
</div>
</div>
{/* Card 3: Your Net Balance (Highlighted state) */}
<div className="p-5 bg-surface-container-lowest border border-outline-variant rounded flex flex-col justify-between">
<div className="flex items-center justify-between text-secondary">
<span className="font-label-caps text-label-caps uppercase">Your Net Balance</span>
<span className="material-symbols-outlined text-[18px] text-primary" data-icon="account_balance_wallet">account_balance_wallet</span>
</div>
<div className="my-3">
<div className="font-label-numeric-lg text-headline-lg font-semibold text-primary tabular-nums tracking-tight">+$420.50</div>
<div className="mt-1 flex items-center gap-1">
<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-label-caps bg-surface-container text-on-surface border border-outline-variant">
                Owed to you
              </span>
</div>
</div>
<div className="flex items-center justify-between font-label-numeric-sm text-label-numeric-sm text-secondary border-t border-surface-container pt-2">
<span>3 pending transfers</span>
<span className="text-on-surface font-medium hover:underline cursor-pointer">Details →</span>
</div>
</div>
{/* Card 4: Daily Burn Rate */}
<div className="p-5 bg-surface-container-lowest border border-outline-variant rounded flex flex-col justify-between">
<div className="flex items-center justify-between text-secondary">
<span className="font-label-caps text-label-caps uppercase">Daily Burn Rate</span>
<span className="material-symbols-outlined text-[18px] text-outline" data-icon="trending_up">trending_up</span>
</div>
<div className="my-3">
<div className="font-label-numeric-lg text-headline-lg font-semibold text-on-surface tabular-nums tracking-tight">$1,435.00<span className="text-body-sm font-normal text-secondary">/day</span></div>
<div className="font-body-sm text-body-sm text-secondary mt-1">Avg pace across 8 days</div>
</div>
<div className="flex items-center justify-between font-label-numeric-sm text-label-numeric-sm text-secondary border-t border-surface-container pt-2">
<span>Peak: Day 3 ($2,840)</span>
<span className="text-on-surface font-medium">On Target</span>
</div>
</div>
</section>
{/* ==================== MIDDLE SECTION: SETTLEMENTS & BREAKDOWN ==================== */}
<section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
{/* LEFT COLUMN: Algorithmic Settlement Flows (7 cols) */}
<div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded p-6 flex flex-col justify-between">
<div>
{/* Section Header */}
<div className="flex items-center justify-between pb-4 border-b border-surface-container">
<div>
<h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">Algorithmic Simplification</h2>
<p className="font-body-sm text-body-sm text-secondary mt-0.5">Optimized debt matrix resolved into 4 minimal bilateral transactions</p>
</div>
<button className="px-3 py-1.5 bg-surface-container text-on-surface border border-outline-variant hover:bg-surface-container-high rounded font-body-sm text-body-sm font-medium transition-colors" type="button">
                Settle All
              </button>
</div>
{/* Settlement Transfer List */}
<div className="divide-y divide-surface-container mt-2">
{/* Item 1: Kenji -> Alex (You) */}
<div className="py-3.5 flex items-center justify-between gap-4">
<div className="flex items-center gap-3">
<div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-label-caps text-label-caps text-on-surface">
                    KS
                  </div>
<div>
<div className="flex items-center gap-1.5 font-body-md text-body-md text-on-surface">
<span className="font-semibold">Kenji Sato</span>
<span className="material-symbols-outlined text-[16px] text-secondary" data-icon="arrow_forward">arrow_forward</span>
<span className="font-medium text-secondary">Alex Morgan <span className="text-label-caps text-[10px] bg-surface-container px-1 py-0.2 rounded font-semibold text-on-surface">YOU</span></span>
</div>
<div className="font-body-sm text-body-sm text-secondary">Note: Bullet train &amp; Shinkansen tickets</div>
</div>
</div>
<div className="flex items-center gap-3 text-right">
<div>
<div className="font-label-numeric-md text-label-numeric-md font-semibold text-on-surface tabular-nums">$280.00</div>
<div className="font-label-caps text-[10px] text-secondary">Pending Transfer</div>
</div>
<div className="flex items-center gap-1.5">
<button className="px-2.5 py-1 bg-surface-container-lowest border border-outline-variant hover:bg-surface-container text-on-surface rounded font-label-caps text-label-caps transition-colors">
                      Remind
                    </button>
<button className="px-2.5 py-1 bg-primary text-on-primary hover:bg-primary-container rounded font-label-caps text-label-caps font-medium transition-colors">
                      Mark Settled
                    </button>
</div>
</div>
</div>
{/* Item 2: Elena -> Sophia */}
<div className="py-3.5 flex items-center justify-between gap-4">
<div className="flex items-center gap-3">
<div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-label-caps text-label-caps text-on-surface">
                    ER
                  </div>
<div>
<div className="flex items-center gap-1.5 font-body-md text-body-md text-on-surface">
<span className="font-semibold">Elena Rostova</span>
<span className="material-symbols-outlined text-[16px] text-secondary" data-icon="arrow_forward">arrow_forward</span>
<span className="font-medium text-secondary">Sophia Chen</span>
</div>
<div className="font-body-sm text-body-sm text-secondary">Note: Kaiseki dinner omakase split</div>
</div>
</div>
<div className="flex items-center gap-3 text-right">
<div>
<div className="font-label-numeric-md text-label-numeric-md font-semibold text-on-surface tabular-nums">$145.50</div>
<div className="font-label-caps text-[10px] text-secondary">Initiated Oct 24</div>
</div>
<span className="px-2.5 py-1 bg-surface-container text-secondary rounded font-label-caps text-label-caps border border-outline-variant">
                    Pending verification
                  </span>
</div>
</div>
{/* Item 3: Liam -> Alex (You) */}
<div className="py-3.5 flex items-center justify-between gap-4">
<div className="flex items-center gap-3">
<div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-label-caps text-label-caps text-on-surface">
                    LV
                  </div>
<div>
<div className="flex items-center gap-1.5 font-body-md text-body-md text-on-surface">
<span className="font-semibold">Liam Vance</span>
<span className="material-symbols-outlined text-[16px] text-secondary" data-icon="arrow_forward">arrow_forward</span>
<span className="font-medium text-secondary">Alex Morgan <span className="text-label-caps text-[10px] bg-surface-container px-1 py-0.2 rounded font-semibold text-on-surface">YOU</span></span>
</div>
<div className="font-body-sm text-body-sm text-secondary">Note: Machiya rental security deposit</div>
</div>
</div>
<div className="flex items-center gap-3 text-right">
<div>
<div className="font-label-numeric-md text-label-numeric-md font-semibold text-on-surface tabular-nums">$140.50</div>
<div className="font-label-caps text-[10px] text-secondary">Direct Wise transfer</div>
</div>
<button className="px-2.5 py-1 bg-primary text-on-primary hover:bg-primary-container rounded font-label-caps text-label-caps font-medium transition-colors">
                    Confirm Receipt
                  </button>
</div>
</div>
{/* Item 4: Marcus -> Sophia */}
<div className="py-3.5 flex items-center justify-between gap-4">
<div className="flex items-center gap-3">
<div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center font-label-caps text-label-caps text-on-surface">
                    MT
                  </div>
<div>
<div className="flex items-center gap-1.5 font-body-md text-body-md text-on-surface">
<span className="font-semibold">Marcus Thorne</span>
<span className="material-symbols-outlined text-[16px] text-secondary" data-icon="arrow_forward">arrow_forward</span>
<span className="font-medium text-secondary">Sophia Chen</span>
</div>
<div className="font-body-sm text-body-sm text-secondary">Note: Arashiyama Bamboo grove taxi</div>
</div>
</div>
<div className="flex items-center gap-3 text-right">
<div>
<div className="font-label-numeric-md text-label-numeric-md font-semibold text-on-surface tabular-nums">$62.00</div>
<div className="font-label-caps text-[10px] text-secondary">Settled Oct 23</div>
</div>
<span className="px-2.5 py-1 bg-primary text-on-primary rounded font-label-caps text-label-caps">
                    Settled
                  </span>
</div>
</div>
</div>
</div>
{/* Bottom Micro Balance Visualization */}
<div className="pt-5 mt-4 border-t border-surface-container">
<div className="flex items-center justify-between text-secondary font-label-caps text-label-caps mb-2">
<span>MEMBER NET DISTRIBUTION</span>
<span>BALANCED (SUM = $0.00)</span>
</div>
<div className="grid grid-cols-6 gap-2 text-center">
<div className="bg-surface-container-low p-2 rounded border border-outline-variant">
<div className="font-label-caps text-[10px] text-secondary">Alex (You)</div>
<div className="font-label-numeric-sm font-semibold text-primary tabular-nums">+$420.50</div>
</div>
<div className="bg-surface-container-low p-2 rounded border border-outline-variant">
<div className="font-label-caps text-[10px] text-secondary">Sophia</div>
<div className="font-label-numeric-sm font-semibold text-primary tabular-nums">+$207.50</div>
</div>
<div className="bg-surface-container-low p-2 rounded border border-outline-variant">
<div className="font-label-caps text-[10px] text-secondary">Kenji</div>
<div className="font-label-numeric-sm font-semibold text-secondary tabular-nums">-$280.00</div>
</div>
<div className="bg-surface-container-low p-2 rounded border border-outline-variant">
<div className="font-label-caps text-[10px] text-secondary">Elena</div>
<div className="font-label-numeric-sm font-semibold text-secondary tabular-nums">-$145.50</div>
</div>
<div className="bg-surface-container-low p-2 rounded border border-outline-variant">
<div className="font-label-caps text-[10px] text-secondary">Liam</div>
<div className="font-label-numeric-sm font-semibold text-secondary tabular-nums">-$140.50</div>
</div>
<div className="bg-surface-container-low p-2 rounded border border-outline-variant">
<div className="font-label-caps text-[10px] text-secondary">Marcus</div>
<div className="font-label-numeric-sm font-semibold text-secondary tabular-nums">-$62.00</div>
</div>
</div>
</div>
</div>
{/* RIGHT COLUMN: Category & Spend Breakdown (5 cols) */}
<div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded p-6 flex flex-col justify-between">
<div>
<div className="flex items-center justify-between pb-4 border-b border-surface-container">
<div>
<h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">Category Allocation</h2>
<p className="font-body-sm text-body-sm text-secondary mt-0.5">Aggregate breakdown of total expenditure</p>
</div>
<span className="font-label-numeric-md font-semibold text-on-surface">$11,480.00</span>
</div>
{/* Category Visual Stack Bar */}
<div className="mt-5 mb-6">
<div className="h-2 w-full flex rounded-full overflow-hidden bg-surface-container">
<div className="bg-primary h-full" style={{width: "41.8%"}} title="Lodging 41.8%"></div>
<div className="bg-on-surface-variant h-full" style={{width: "27.2%"}} title="Dining 27.2%"></div>
<div className="bg-secondary h-full" style={{width: "17.8%"}} title="Transit 17.8%"></div>
<div className="bg-outline-variant h-full" style={{width: "13.2%"}} title="Activities 13.2%"></div>
</div>
</div>
{/* Category Detailed Rows */}
<div className="space-y-4">
{/* Lodging */}
<div>
<div className="flex items-center justify-between text-body-sm">
<div className="flex items-center gap-2">
<span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
<span className="font-medium text-on-surface">Lodging &amp; Ryokans</span>
</div>
<div className="flex items-center gap-3">
<span className="font-label-numeric-sm text-secondary">41.8%</span>
<span className="font-label-numeric-md font-semibold text-on-surface tabular-nums">$4,800.00</span>
</div>
</div>
<div className="mt-1.5 w-full bg-surface-container h-1 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{width: "41.8%"}}></div>
</div>
</div>
{/* Dining & Markets */}
<div>
<div className="flex items-center justify-between text-body-sm">
<div className="flex items-center gap-2">
<span className="w-2.5 h-2.5 rounded-full bg-on-surface-variant inline-block"></span>
<span className="font-medium text-on-surface">Dining &amp; Food Markets</span>
</div>
<div className="flex items-center gap-3">
<span className="font-label-numeric-sm text-secondary">27.2%</span>
<span className="font-label-numeric-md font-semibold text-on-surface tabular-nums">$3,120.00</span>
</div>
</div>
<div className="mt-1.5 w-full bg-surface-container h-1 rounded-full overflow-hidden">
<div className="bg-on-surface-variant h-full rounded-full" style={{width: "27.2%"}}></div>
</div>
</div>
{/* Transit & Rail */}
<div>
<div className="flex items-center justify-between text-body-sm">
<div className="flex items-center gap-2">
<span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block"></span>
<span className="font-medium text-on-surface">Transit &amp; Shinkansen Rail</span>
</div>
<div className="flex items-center gap-3">
<span className="font-label-numeric-sm text-secondary">17.8%</span>
<span className="font-label-numeric-md font-semibold text-on-surface tabular-nums">$2,040.00</span>
</div>
</div>
<div className="mt-1.5 w-full bg-surface-container h-1 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{width: "17.8%"}}></div>
</div>
</div>
{/* Activities & Passes */}
<div>
<div className="flex items-center justify-between text-body-sm">
<div className="flex items-center gap-2">
<span className="w-2.5 h-2.5 rounded-full bg-outline-variant inline-block"></span>
<span className="font-medium text-on-surface">Activities &amp; Guided Tours</span>
</div>
<div className="flex items-center gap-3">
<span className="font-label-numeric-sm text-secondary">13.2%</span>
<span className="font-label-numeric-md font-semibold text-on-surface tabular-nums">$1,520.00</span>
</div>
</div>
<div className="mt-1.5 w-full bg-surface-container h-1 rounded-full overflow-hidden">
<div className="bg-outline-variant h-full rounded-full" style={{width: "13.2%"}}></div>
</div>
</div>
</div>
</div>
{/* Currency Conversion Summary Note */}
<div className="mt-6 pt-4 border-t border-surface-container bg-surface-container-low p-3 rounded border border-outline-variant">
<div className="flex items-start gap-2">
<span className="material-symbols-outlined text-[16px] text-secondary mt-0.5" data-icon="info">info</span>
<p className="font-body-sm text-[11px] text-secondary leading-relaxed">
                All foreign transactions converted instantly at institutional mid-market rates without hidden card markups. Last rate fetch: 12 minutes ago.
              </p>
</div>
</div>
</div>
</section>
{/* ==================== BOTTOM SECTION: GRANULAR LEDGER TABLE ==================== */}
<section aria-label="Granular Recent Expenses Table" className="bg-surface-container-lowest border border-outline-variant rounded overflow-hidden">
{/* Table Action Header Bar */}
<div className="p-5 border-b border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4">
<div className="flex items-center gap-3">
<h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">Recent Ledger Entries</h2>
<span className="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-label-caps text-label-caps">
              48 transactions
            </span>
</div>
{/* Filter Pills & Search */}
<div className="flex flex-wrap items-center gap-2">
<div className="flex items-center border border-outline-variant rounded p-0.5 bg-surface-container-lowest">
<button className="px-2.5 py-1 font-label-caps text-label-caps bg-primary text-on-primary rounded font-medium">All</button>
<button className="px-2.5 py-1 font-label-caps text-label-caps text-secondary hover:text-on-surface transition-colors">Lodging</button>
<button className="px-2.5 py-1 font-label-caps text-label-caps text-secondary hover:text-on-surface transition-colors">Dining</button>
<button className="px-2.5 py-1 font-label-caps text-label-caps text-secondary hover:text-on-surface transition-colors">Transit</button>
<button className="px-2.5 py-1 font-label-caps text-label-caps text-secondary hover:text-on-surface transition-colors">Activities</button>
</div>
<div className="h-4 w-[1px] bg-outline-variant mx-1 hidden sm:block"></div>
<button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-body-sm text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors">
<span className="material-symbols-outlined text-[16px]" data-icon="filter_list">filter_list</span>
<span>Filter</span>
</button>
<button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-body-sm text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors">
<span className="material-symbols-outlined text-[16px]" data-icon="download">download</span>
<span>CSV</span>
</button>
</div>
</div>
{/* Data Table */}
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface-container-low border-b border-outline-variant text-secondary font-label-caps text-label-caps uppercase h-9">
<th className="py-2 px-4 font-semibold w-24">Date</th>
<th className="py-2 px-4 font-semibold">Description / Merchant</th>
<th className="py-2 px-4 font-semibold w-32">Category</th>
<th className="py-2 px-4 font-semibold">Paid By</th>
<th className="py-2 px-4 font-semibold">Split With</th>
<th className="py-2 px-4 font-semibold text-right">Total Amount</th>
<th className="py-2 px-4 font-semibold text-right">Your Share</th>
<th className="py-2 px-3 font-semibold text-center w-12"></th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container font-body-md text-body-md text-on-surface">
{/* Row 1: Ryokan Lodging */}
<tr className="hover:bg-surface-container-low transition-colors duration-100 group">
<td className="py-3 px-4 font-label-numeric-sm text-secondary tabular-nums">Oct 24</td>
<td className="py-3 px-4 font-medium text-on-surface">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary" data-icon="hotel">hotel</span>
<span>Tawaraya Ryokan 2 Nights</span>
</div>
</td>
<td className="py-3 px-4">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label-caps bg-surface-container text-on-surface border border-outline-variant">
                    Lodging
                  </span>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-2">
<div className="w-5 h-5 rounded-full bg-primary-container text-on-primary text-[10px] flex items-center justify-center font-label-caps font-semibold">AM</div>
<span className="font-body-sm text-body-sm font-medium">Alex Morgan (You)</span>
</div>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-1.5 text-secondary font-body-sm text-body-sm">
<span className="material-symbols-outlined text-[15px]" data-icon="group">group</span>
<span>Split All 6</span>
</div>
</td>
<td className="py-3 px-4 text-right font-label-numeric-md font-semibold text-on-surface tabular-nums">
                  $2,400.00
                </td>
<td className="py-3 px-4 text-right font-label-numeric-md font-semibold text-secondary tabular-nums">
                  $400.00
                </td>
<td className="py-3 px-3 text-center">
<button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container rounded text-secondary transition-opacity">
<span className="material-symbols-outlined text-[18px]" data-icon="more_horiz">more_horiz</span>
</button>
</td>
</tr>
{/* Row 2: Shinkansen Nozomi */}
<tr className="hover:bg-surface-container-low transition-colors duration-100 group">
<td className="py-3 px-4 font-label-numeric-sm text-secondary tabular-nums">Oct 23</td>
<td className="py-3 px-4 font-medium text-on-surface">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary" data-icon="directions_transit">directions_transit</span>
<span>Shinkansen Nozomi (Tokyo-Kyoto)</span>
</div>
</td>
<td className="py-3 px-4">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label-caps bg-surface-container text-on-surface border border-outline-variant">
                    Transit
                  </span>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-2">
<div className="w-5 h-5 rounded-full bg-surface-container text-on-surface text-[10px] border border-outline-variant flex items-center justify-center font-label-caps font-semibold">KS</div>
<span className="font-body-sm text-body-sm">Kenji Sato</span>
</div>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-1.5 text-secondary font-body-sm text-body-sm">
<span className="material-symbols-outlined text-[15px]" data-icon="group">group</span>
<span>Split All 6</span>
</div>
</td>
<td className="py-3 px-4 text-right font-label-numeric-md font-semibold text-on-surface tabular-nums">
                  $840.00
                </td>
<td className="py-3 px-4 text-right font-label-numeric-md font-semibold text-secondary tabular-nums">
                  $140.00
                </td>
<td className="py-3 px-3 text-center">
<button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container rounded text-secondary transition-opacity">
<span className="material-symbols-outlined text-[18px]" data-icon="more_horiz">more_horiz</span>
</button>
</td>
</tr>
{/* Row 3: Kaiseki Dinner */}
<tr className="hover:bg-surface-container-low transition-colors duration-100 group">
<td className="py-3 px-4 font-label-numeric-sm text-secondary tabular-nums">Oct 23</td>
<td className="py-3 px-4 font-medium text-on-surface">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary" data-icon="restaurant">restaurant</span>
<span>Gion Sasaki Kaiseki Omakase</span>
</div>
</td>
<td className="py-3 px-4">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label-caps bg-surface-container text-on-surface border border-outline-variant">
                    Dining
                  </span>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-2">
<div className="w-5 h-5 rounded-full bg-surface-container text-on-surface text-[10px] border border-outline-variant flex items-center justify-center font-label-caps font-semibold">SC</div>
<span className="font-body-sm text-body-sm">Sophia Chen</span>
</div>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-1.5 text-secondary font-body-sm text-body-sm">
<span className="material-symbols-outlined text-[15px]" data-icon="group">group</span>
<span>Split All 6</span>
</div>
</td>
<td className="py-3 px-4 text-right font-label-numeric-md font-semibold text-on-surface tabular-nums">
                  $1,260.00
                </td>
<td className="py-3 px-4 text-right font-label-numeric-md font-semibold text-secondary tabular-nums">
                  $210.00
                </td>
<td className="py-3 px-3 text-center">
<button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container rounded text-secondary transition-opacity">
<span className="material-symbols-outlined text-[18px]" data-icon="more_horiz">more_horiz</span>
</button>
</td>
</tr>
{/* Row 4: Fushimi Inari Guided Tour (Split 4 members) */}
<tr className="hover:bg-surface-container-low transition-colors duration-100 group">
<td className="py-3 px-4 font-label-numeric-sm text-secondary tabular-nums">Oct 22</td>
<td className="py-3 px-4 font-medium text-on-surface">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary" data-icon="tour">tour</span>
<span>Fushimi Inari Guided Sunrise Tour</span>
</div>
</td>
<td className="py-3 px-4">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label-caps bg-surface-container text-on-surface border border-outline-variant">
                    Activities
                  </span>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-2">
<div className="w-5 h-5 rounded-full bg-primary-container text-on-primary text-[10px] flex items-center justify-center font-label-caps font-semibold">AM</div>
<span className="font-body-sm text-body-sm font-medium">Alex Morgan (You)</span>
</div>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-1.5 text-secondary font-body-sm text-body-sm">
<span className="material-symbols-outlined text-[15px]" data-icon="person">person</span>
<span>Split 4 members</span>
</div>
</td>
<td className="py-3 px-4 text-right font-label-numeric-md font-semibold text-on-surface tabular-nums">
                  $320.00
                </td>
<td className="py-3 px-4 text-right font-label-numeric-md font-semibold text-secondary tabular-nums">
                  $80.00
                </td>
<td className="py-3 px-3 text-center">
<button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container rounded text-secondary transition-opacity">
<span className="material-symbols-outlined text-[18px]" data-icon="more_horiz">more_horiz</span>
</button>
</td>
</tr>
{/* Row 5: Nishiki Market Food Tasting */}
<tr className="hover:bg-surface-container-low transition-colors duration-100 group">
<td className="py-3 px-4 font-label-numeric-sm text-secondary tabular-nums">Oct 21</td>
<td className="py-3 px-4 font-medium text-on-surface">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary" data-icon="storefront">storefront</span>
<span>Nishiki Market Street Food Tasting</span>
</div>
</td>
<td className="py-3 px-4">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label-caps bg-surface-container text-on-surface border border-outline-variant">
                    Dining
                  </span>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-2">
<div className="w-5 h-5 rounded-full bg-surface-container text-on-surface text-[10px] border border-outline-variant flex items-center justify-center font-label-caps font-semibold">LV</div>
<span className="font-body-sm text-body-sm">Liam Vance</span>
</div>
</td>
<td className="py-3 px-4">
<div className="flex items-center gap-1.5 text-secondary font-body-sm text-body-sm">
<span className="material-symbols-outlined text-[15px]" data-icon="group">group</span>
<span>Split All 6</span>
</div>
</td>
<td className="py-3 px-4 text-right font-label-numeric-md font-semibold text-on-surface tabular-nums">
                  $186.00
                </td>
<td className="py-3 px-4 text-right font-label-numeric-md font-semibold text-secondary tabular-nums">
                  $31.00
                </td>
<td className="py-3 px-3 text-center">
<button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container rounded text-secondary transition-opacity">
<span className="material-symbols-outlined text-[18px]" data-icon="more_horiz">more_horiz</span>
</button>
</td>
</tr>
</tbody>
</table>
</div>
{/* Table Footer / Pagination */}
<div className="p-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-between font-body-sm text-body-sm text-secondary">
<div>
            Showing <span className="font-medium text-on-surface">1 - 5</span> of 48 transactions
          </div>
<div className="flex items-center gap-2">
<button className="px-2.5 py-1 bg-surface-container-lowest border border-outline-variant rounded hover:bg-surface-container text-on-surface disabled:opacity-40 transition-colors" disabled={true}>
              Previous
            </button>
<span className="font-label-numeric-sm px-2 text-on-surface">Page 1 of 10</span>
<button className="px-2.5 py-1 bg-surface-container-lowest border border-outline-variant rounded hover:bg-surface-container text-on-surface transition-colors">
              Next
            </button>
</div>
</div>
</section>
</div>
</main>


    </>
  );
}

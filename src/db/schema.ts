import {
  pgTable,
  uuid,
  text,
  varchar,
  bigint,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

// 1. PROFILES
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // matches auth.users.id
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  monthlyAllowance: bigint("monthly_allowance", { mode: "bigint" }).default(sql`0`),
  paydayDay: integer("payday_day").default(1),
  allowanceCycle: varchar("allowance_cycle", { length: 20 }).default("monthly"), // 'monthly' | 'weekly' | 'flexible'
  paydayWeekday: integer("payday_weekday").default(1), // 0=Minggu, 1=Senin ... 6=Sabtu
  reserveMode: varchar("reserve_mode", { length: 20 }).default("none"), // 'none' | 'daily_fixed' | 'percent' | 'daily_cap'
  reserveValue: bigint("reserve_value", { mode: "bigint" }).default(sql`0`),
  timezone: text("timezone").default("Asia/Jakarta"),
  theme: varchar("theme", { length: 20 }).default("dark"), // 'dark' | 'light' | 'system'
  reminderTime: varchar("reminder_time", { length: 10 }), // e.g. '20:00'
  reminderEnabled: boolean("reminder_enabled").default(false),
  showMotivation: boolean("show_motivation").default(true),
  motivationNotifEnabled: boolean("motivation_notif_enabled").default(false),
  motivationNotifTime: varchar("motivation_notif_time", { length: 10 }).default("07:30"),
  recentMotivationIds: jsonb("recent_motivation_ids").default(sql`'[]'::jsonb`),
  pinHash: text("pin_hash"),
  pinEnabled: boolean("pin_enabled").default(false),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow(),
  autoCarryoverGoalId: uuid("auto_carryover_goal_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2. CATEGORIES
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'income' | 'expense'
    icon: varchar("icon", { length: 50 }).notNull(),
    color: varchar("color", { length: 50 }).notNull(),
    isDefault: boolean("is_default").default(false),
    isHidden: boolean("is_hidden").default(false),
    requiresLabel: boolean("requires_label").default(false), // true for legacy 'Kebutuhan Lain'
    defaultCadence: varchar("default_cadence", { length: 20 }).default("monthly").notNull(), // 'daily' | 'weekly' | 'monthly'
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userSortIdx: index("categories_user_sort_idx").on(table.userId, table.sortOrder),
  })
);

// 3. TRANSACTIONS
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 20 }).notNull(), // 'income' | 'expense'
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    occurredOn: date("occurred_on").notNull().defaultNow(),
    note: text("note"),
    customLabel: varchar("custom_label", { length: 60 }),
    accountId: uuid("account_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userOccurredIdx: index("transactions_user_occurred_idx").on(table.userId, table.occurredOn),
    userCatOccurredIdx: index("transactions_user_cat_occurred_idx").on(
      table.userId,
      table.categoryId,
      table.occurredOn
    ),
  })
);

// 4. BUDGETS
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    month: date("month").notNull(), // 1st of each month (YYYY-MM-01)
    totalLimit: bigint("total_limit", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userMonthUnq: uniqueIndex("budgets_user_month_idx").on(table.userId, table.month),
  })
);

// 5. CATEGORY BUDGETS
export const categoryBudgets = pgTable(
  "category_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    limitAmount: bigint("limit_amount", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    budgetCatUnq: uniqueIndex("cat_budgets_unq_idx").on(table.budgetId, table.categoryId),
  })
);

// 5B. CATEGORY POTS (Konfigurasi Pos Jatah Kategori per User)
export const categoryPots = pgTable(
  "category_pots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    cadence: varchar("cadence", { length: 20 }).default("monthly").notNull(), // 'daily' | 'weekly' | 'monthly'
    unitAmount: bigint("unit_amount", { mode: "bigint" }).default(sql`0`).notNull(),
    isLockedFromDaily: boolean("is_locked_from_daily").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    inactivePeriods: integer("inactive_periods").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCatUnq: uniqueIndex("category_pots_user_cat_unq").on(table.userId, table.categoryId),
    userArchivedIdx: index("category_pots_user_archived_idx").on(table.userId, table.isArchived),
  })
);

// 5C. CATEGORY POT PERIODS (Snapshot Jatah & Penyesuaian per Siklus Berjalan)
export const categoryPotPeriods = pgTable(
  "category_pot_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    potId: uuid("pot_id")
      .notNull()
      .references(() => categoryPots.id, { onDelete: "cascade" }),
    periodKey: varchar("period_key", { length: 32 }).notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    baseLimit: bigint("base_limit", { mode: "bigint" }).notNull(),
    allocatedAmount: bigint("allocated_amount", { mode: "bigint" }).notNull(),
    carryoverClaimedAmount: bigint("carryover_claimed_amount", { mode: "bigint" }).default(sql`0`).notNull(),
    carryoverClaimedAt: timestamp("carryover_claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    potPeriodUnq: uniqueIndex("category_pot_periods_pot_period_unq").on(table.potId, table.periodKey),
    userPeriodIdx: index("category_pot_periods_user_period_idx").on(table.userId, table.periodKey),
  })
);

// 5D. CATEGORY POT TRANSFERS (Log Audit Geser Jatah)
export const categoryPotTransfers = pgTable(
  "category_pot_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    periodKey: varchar("period_key", { length: 32 }).notNull(),
    fromPotId: uuid("from_pot_id")
      .notNull()
      .references(() => categoryPots.id, { onDelete: "cascade" }),
    toPotId: uuid("to_pot_id")
      .notNull()
      .references(() => categoryPots.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userPeriodIdx: index("category_pot_transfers_user_period_idx").on(table.userId, table.periodKey),
  })
);

// 6. SAVINGS GOALS
export const savingsGoals = pgTable("savings_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  targetAmount: bigint("target_amount", { mode: "bigint" }).notNull(),
  targetDate: date("target_date"),
  icon: varchar("icon", { length: 50 }).notNull(),
  color: varchar("color", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(), // 'active' | 'completed' | 'archived'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 7. SAVINGS ENTRIES
export const savingsEntries = pgTable(
  "savings_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => savingsGoals.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'deposit' | 'withdraw'
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    occurredOn: date("occurred_on").notNull().defaultNow(),
    note: text("note"),
    source: varchar("source", { length: 20 }).default("manual").notNull(), // 'manual' | 'carryover'
    carryoverKey: varchar("carryover_key", { length: 40 }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userOccurredIdx: index("savings_entries_user_occurred_idx").on(table.userId, table.occurredOn),
  })
);

// 8. MOTIVATIONS
export const motivations = pgTable("motivations", {
  id: uuid("id").defaultRandom().primaryKey(),
  text: varchar("text", { length: 140 }).notNull(),
  category: varchar("category", { length: 20 }).notNull(), // 'tabungan' | 'orang_tua' | 'umum'
  hasVariable: boolean("has_variable").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 9. PUSH SUBSCRIPTIONS
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  keys: jsonb("keys").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 10. ACCOUNTS (Multi Rekening: Bank, E-Wallet, Tunai)
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'bank' | 'ewallet' | 'cash'
    accountNumber: varchar("account_number", { length: 60 }),
    balance: bigint("balance", { mode: "bigint" }).default(sql`0`).notNull(),
    color: varchar("color", { length: 30 }).default("#D4FF5A").notNull(),
    icon: varchar("icon", { length: 50 }).default("Wallet").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userAccountIdx: index("accounts_user_idx").on(table.userId),
  })
);

// 11. TRANSFERS (Pindah Saldo Antar Rekening)
export const transfers = pgTable(
  "transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    fromAccountId: uuid("from_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    toAccountId: uuid("to_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    adminFee: bigint("admin_fee", { mode: "bigint" }).default(sql`0`).notNull(),
    occurredOn: date("occurred_on").notNull().defaultNow(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userTransferIdx: index("transfers_user_idx").on(table.userId, table.occurredOn),
  })
);

// 12. DEBTS (Catatan Utang & Piutang Teman)
export const debts = pgTable(
  "debts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'payable' (Saya Berutang) | 'receivable' (Teman Ngutang)
    personName: varchar("person_name", { length: 100 }).notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    paidAmount: bigint("paid_amount", { mode: "bigint" }).default(sql`0`).notNull(),
    dueDate: date("due_date"),
    status: varchar("status", { length: 20 }).default("unpaid").notNull(), // 'unpaid' | 'partial' | 'paid'
    note: text("note"),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userDebtsIdx: index("debts_user_idx").on(table.userId, table.status),
  })
);

// 13. DEBT PAYMENTS (Cicilan / Pelunasan Utang)
export const debtPayments = pgTable(
  "debt_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    debtId: uuid("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    occurredOn: date("occurred_on").notNull().defaultNow(),
    note: text("note"),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    debtPaymentsIdx: index("debt_payments_debt_idx").on(table.debtId),
  })
);

// 14. APP RELEASES (Distribusi APK & Info Versi)
export const appReleases = pgTable(
  "app_releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    version: varchar("version", { length: 20 }).notNull(), // e.g. '1.0.0'
    versionCode: integer("version_code").notNull().default(1),
    apkUrlPrimary: text("apk_url_primary").notNull(),
    apkUrlMirror: text("apk_url_mirror"),
    sha256: varchar("sha256", { length: 64 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(2621440), // ~2.5 MB
    releasedAt: timestamp("released_at", { withTimezone: true }).defaultNow().notNull(),
    changelog: text("changelog"),
    isLatest: boolean("is_latest").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    versionIdx: uniqueIndex("app_releases_version_idx").on(table.version),
    latestIdx: index("app_releases_latest_idx").on(table.isLatest),
  })
);

// 15. LOCKED FUNDS (Dana Terkunci / Tagihan Wajib: Kos, WiFi, Token, Cicilan)
export const lockedFunds = pgTable(
  "locked_funds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    dueDay: integer("due_day"),
    isPaid: boolean("is_paid").default(false).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidAccountId: uuid("paid_account_id").references(() => accounts.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userLockedIdx: index("locked_funds_user_idx").on(table.userId),
  })
);

// RELATIONS
export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
  pots: many(categoryPots),
}));

export const categoryPotsRelations = relations(categoryPots, ({ one, many }) => ({
  category: one(categories, {
    fields: [categoryPots.categoryId],
    references: [categories.id],
  }),
  periods: many(categoryPotPeriods),
}));

export const categoryPotPeriodsRelations = relations(categoryPotPeriods, ({ one }) => ({
  pot: one(categoryPots, {
    fields: [categoryPotPeriods.potId],
    references: [categoryPots.id],
  }),
}));

export const categoryPotTransfersRelations = relations(categoryPotTransfers, ({ one }) => ({
  fromPot: one(categoryPots, {
    fields: [categoryPotTransfers.fromPotId],
    references: [categoryPots.id],
  }),
  toPot: one(categoryPots, {
    fields: [categoryPotTransfers.toPotId],
    references: [categoryPots.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
  transfersFrom: many(transfers, { relationName: "fromAccount" }),
  transfersTo: many(transfers, { relationName: "toAccount" }),
  debts: many(debts),
  savingsEntries: many(savingsEntries),
}));

export const transfersRelations = relations(transfers, ({ one }) => ({
  fromAccount: one(accounts, {
    fields: [transfers.fromAccountId],
    references: [accounts.id],
    relationName: "fromAccount",
  }),
  toAccount: one(accounts, {
    fields: [transfers.toAccountId],
    references: [accounts.id],
    relationName: "toAccount",
  }),
}));

export const debtsRelations = relations(debts, ({ one, many }) => ({
  account: one(accounts, {
    fields: [debts.accountId],
    references: [accounts.id],
  }),
  payments: many(debtPayments),
}));

export const debtPaymentsRelations = relations(debtPayments, ({ one }) => ({
  debt: one(debts, {
    fields: [debtPayments.debtId],
    references: [debts.id],
  }),
  account: one(accounts, {
    fields: [debtPayments.accountId],
    references: [accounts.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({ many }) => ({
  entries: many(savingsEntries),
}));

export const savingsEntriesRelations = relations(savingsEntries, ({ one }) => ({
  goal: one(savingsGoals, {
    fields: [savingsEntries.goalId],
    references: [savingsGoals.id],
  }),
  account: one(accounts, {
    fields: [savingsEntries.accountId],
    references: [accounts.id],
  }),
}));

export const lockedFundsRelations = relations(lockedFunds, ({ one }) => ({
  paidAccount: one(accounts, {
    fields: [lockedFunds.paidAccountId],
    references: [accounts.id],
  }),
}));

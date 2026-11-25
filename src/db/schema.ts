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
    requiresLabel: boolean("requires_label").default(false), // true for 'Kebutuhan Lain'
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

// RELATIONS
export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
  transfersFrom: many(transfers, { relationName: "fromAccount" }),
  transfersTo: many(transfers, { relationName: "toAccount" }),
  debts: many(debts),
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
}));

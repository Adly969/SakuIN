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

// RELATIONS
export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
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

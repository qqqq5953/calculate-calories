CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "conversation_states" (
	"user_id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"tfda_code" text,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"kcal_100g" numeric NOT NULL,
	"protein_100g" numeric NOT NULL,
	"carb_100g" numeric NOT NULL,
	"fat_100g" numeric NOT NULL,
	"default_unit" text,
	"unit_grams" numeric,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foods_tfda_code_unique" UNIQUE("tfda_code")
);
--> statement-breakpoint
CREATE TABLE "meal_items" (
	"id" text PRIMARY KEY NOT NULL,
	"meal_id" text NOT NULL,
	"position" smallint NOT NULL,
	"food_id" text,
	"name" text NOT NULL,
	"portion" numeric NOT NULL,
	"unit" text NOT NULL,
	"unit_grams" numeric NOT NULL,
	"kcal_100g" numeric NOT NULL,
	"protein_100g" numeric NOT NULL,
	"carb_100g" numeric NOT NULL,
	"fat_100g" numeric NOT NULL,
	"grams" numeric NOT NULL,
	"kcal" numeric NOT NULL,
	"protein_g" numeric NOT NULL,
	"carb_g" numeric NOT NULL,
	"fat_g" numeric NOT NULL,
	"confidence" text DEFAULT 'high' NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"added_by" text DEFAULT 'ai' NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"eaten_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meal_type" text NOT NULL,
	"source" text NOT NULL,
	"photo_path" text,
	"version" integer DEFAULT 1 NOT NULL,
	"ai_raw" jsonb,
	"possibly_missed" text[] DEFAULT '{}'::text[] NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"line_user_id" text NOT NULL,
	"display_name" text,
	"sex" text,
	"birth_year" smallint,
	"height_cm" numeric,
	"weight_kg" numeric,
	"activity_level" text,
	"goal" text,
	"target_kcal" integer DEFAULT 2000 NOT NULL,
	"target_protein_g" integer DEFAULT 75 NOT NULL,
	"target_carb_g" integer DEFAULT 260 NOT NULL,
	"target_fat_g" integer DEFAULT 60 NOT NULL,
	"timezone" text DEFAULT 'Asia/Taipei' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_states" ADD CONSTRAINT "conversation_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "foods_name_trgm_idx" ON "foods" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "foods_aliases_idx" ON "foods" USING gin ("aliases");--> statement-breakpoint
CREATE INDEX "foods_category_idx" ON "foods" USING btree ("category","popularity");--> statement-breakpoint
CREATE INDEX "meal_items_meal_idx" ON "meal_items" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "meals_user_eaten_idx" ON "meals" USING btree ("user_id","eaten_at");
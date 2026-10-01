# Supabase login setup

The workout tracker now uses Supabase for email/password authentication. The old browser-only accounts are intentionally ignored.

## 1. Create a Supabase project

Sign in at [supabase.com](https://supabase.com), create a project, and wait for it to finish provisioning.

## 2. Copy the browser-safe connection values

Open the project's **Connect** dialog and copy:

- Project URL
- Publishable key (starts with `sb_publishable_`)

Do not use a secret key or service-role key in this website.

## 3. Configure the tracker

Open `supabase-config.js` and replace the two placeholder values:

```js
window.WORKOUT_TRACKER_SUPABASE_CONFIG = {
    url: "https://your-project.supabase.co",
    publishableKey: "sb_publishable_your_key"
};
```

The publishable key is designed for browser applications. Database security will be added with Row Level Security when workouts and routines move online.

## 4. Choose the email confirmation behavior

Supabase normally requires a new user to confirm their email before signing in. Keep that enabled for the more secure production behavior.

In **Authentication > URL Configuration**, use these values while testing locally:

- Site URL: `http://localhost:4173/welcome.html`
- Redirect URLs: add `http://localhost:4173/email-confirmed.html`

The redirect entry lets the signup email open the tracker's styled confirmation page. When the tracker is published, replace the Site URL and add the hosted version of `email-confirmed.html` to the redirect list.

## 5. Create secure online workout storage

Open **SQL Editor** in Supabase, select **New query**, paste the complete contents of `database-setup.sql`, and select **Run**.

This creates one protected data record per account. Row Level Security restricts normal workout and routine access to the signed-in owner. The leaderboard functions return only an athlete's first name, best score, and workout date; they do not expose notes, routines, or full workout history.

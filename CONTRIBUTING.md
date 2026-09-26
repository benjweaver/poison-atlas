# Contributing

Thanks for helping. Corrections to ranges, sources, lookalikes, and species are
the most useful contributions of all.

## The data rules

Read [CLAUDE.md](CLAUDE.md) and the README first. Above all:

- **Nothing is added or removed without a verifiable source.** Every
  toxicity claim, and every `gbif.include` / `gbif.exclude`, needs a URL or
  citation you have actually checked.
- **No preparation, extraction, or dosage information,** and no instructions
  for making anything safe to eat. Where something is only eaten after
  traditional processing, say it's toxic raw and cite a source, without the
  method. Pull requests that add such instructions will be closed.

Run `npm run check` before opening a pull request; CI runs the same checks.

## Licensing your contribution

By submitting a contribution (code, data, or documentation), you agree that:

1. it is your own work, or you have the right to submit it;
2. it is licensed under the project's licences: code under the GNU General
   Public License v3.0 or later, data under CC BY-SA 4.0; and
3. you also grant Ben Weaver a perpetual, worldwide, non-exclusive,
   royalty-free licence to use, modify, and distribute your contribution under
   other terms, so it can be included in app store builds (such as Apple's App
   Store) whose terms conflict with the GPL. The project and its website stay
   free and open under the licences above.

If you're not comfortable with point 3, say so in your pull request. It's fine,
but the change can't be merged.

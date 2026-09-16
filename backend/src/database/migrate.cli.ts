import {
  closeMigrationPool,
  migrate,
  migrationStatus,
  resetDevelopmentDatabase,
  seedDatabase,
} from "./migrator";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "up";

  switch (command) {
    case "up":
      await migrate();
      break;
    case "baseline":
      await migrate({ baselineExisting: true });
      break;
    case "status": {
      const status = await migrationStatus();
      console.log(`Applied: ${status.applied.length}`);
      for (const name of status.applied) console.log(`  applied  ${name}`);
      console.log(`Pending: ${status.pending.length}`);
      for (const name of status.pending) console.log(`  pending  ${name}`);
      break;
    }
    case "seed":
      await seedDatabase();
      break;
    case "reset":
      await resetDevelopmentDatabase();
      await migrate();
      await seedDatabase();
      break;
    default:
      throw new Error(
        `Unknown migration command "${command}". Use up, baseline, status, seed, or reset.`
      );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeMigrationPool);

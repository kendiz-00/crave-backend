import { seedDatabase } from "../src/utils/seedDatabase";

seedDatabase()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

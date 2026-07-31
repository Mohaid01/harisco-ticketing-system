export default {
  "*.{ts,tsx}": ["npm run lint", "npx tsc --noEmit"],
  "*.{js,json,md}": ["npm run lint"],
};

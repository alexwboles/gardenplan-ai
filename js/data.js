/* GardenPlan data — plant bank (41 plants) + zone frost table. Browser + node. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else root.GardenData = Object.assign(root.GardenData || {}, factory());
})(typeof self !== "undefined" ? self : this, function () {

  // Approximate average last spring frost by USDA hardiness zone (MM-DD).
  // Shown as approximate in the UI; the user can override the date.
  var ZONE_FROST = {
    "1": "06-10", "2": "05-20", "3": "05-10", "4": "05-01", "5": "04-20",
    "6": "04-10", "7": "04-01", "8": "03-20", "9": "02-25", "10": "02-01",
    "11": "01-20", "12": "01-10", "13": "01-05"
  };

  // indoor: start seeds indoors N weeks BEFORE last frost (null = don't start indoors)
  // transplant: move seedlings out N weeks AFTER last frost (null = n/a)
  // sow: direct-sow N weeks AFTER last frost, negative = before (null = n/a)
  // harvest: days from transplant/sow to harvest
  var PLANTS = [
    { name: "Tomato", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: 6, transplant: 2, sow: null, harvest: 75, spacing: 24, notes: "Needs staking or cages." },
    { name: "Cherry Tomato", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: 6, transplant: 2, sow: null, harvest: 65, spacing: 24, notes: "Prolific — 1-2 plants per person is plenty." },
    { name: "Bell Pepper", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: 8, transplant: 3, sow: null, harvest: 75, spacing: 18, notes: "Loves heat; black mulch helps." },
    { name: "Hot Pepper", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: 8, transplant: 3, sow: null, harvest: 80, spacing: 18, notes: "The hotter the summer, the hotter the pepper." },
    { name: "Cucumber", type: "Vegetable", sun: "Full sun", water: "High", indoor: 3, transplant: 2, sow: 2, harvest: 55, spacing: 12, notes: "Trellis to save space and keep fruit clean." },
    { name: "Zucchini", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: null, transplant: null, sow: 2, harvest: 50, spacing: 36, notes: "One plant feeds a neighborhood. You were warned." },
    { name: "Carrot", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: null, transplant: null, sow: -3, harvest: 70, spacing: 3, notes: "Keep soil evenly moist until germination." },
    { name: "Lettuce", type: "Vegetable", sun: "Partial shade", water: "High", indoor: null, transplant: null, sow: -4, harvest: 45, spacing: 8, notes: "Sow every 2 weeks for continuous harvest." },
    { name: "Spinach", type: "Vegetable", sun: "Partial shade", water: "High", indoor: null, transplant: null, sow: -4, harvest: 40, spacing: 6, notes: "Bolts in heat — spring and fall crop." },
    { name: "Kale", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: 6, transplant: 0, sow: -2, harvest: 55, spacing: 18, notes: "Sweeter after a light frost." },
    { name: "Broccoli", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: 6, transplant: 0, sow: null, harvest: 70, spacing: 18, notes: "Side shoots keep coming after the main head." },
    { name: "Cauliflower", type: "Vegetable", sun: "Partial shade", water: "High", indoor: 6, transplant: 0, sow: null, harvest: 75, spacing: 18, notes: "Tie leaves over heads to blanch." },
    { name: "Cabbage", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: 6, transplant: -1, sow: null, harvest: 75, spacing: 18, notes: "Watch for cabbage worms — row cover helps." },
    { name: "Onion (sets)", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: null, transplant: null, sow: -4, harvest: 100, spacing: 6, notes: "Stop watering when tops fall over." },
    { name: "Garlic", type: "Vegetable", sun: "Full sun", water: "Low", indoor: null, transplant: null, sow: -20, harvest: 240, spacing: 6, notes: "Plant cloves in fall for summer harvest." },
    { name: "Potato", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: null, transplant: null, sow: 1, harvest: 80, spacing: 12, notes: "Hill soil up around stems as they grow." },
    { name: "Green Beans", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: null, transplant: null, sow: 2, harvest: 55, spacing: 6, notes: "Pick often — it triggers more beans." },
    { name: "Peas", type: "Vegetable", sun: "Partial shade", water: "Medium", indoor: null, transplant: null, sow: -4, harvest: 60, spacing: 3, notes: "Give them something to climb." },
    { name: "Corn", type: "Vegetable", sun: "Full sun", water: "High", indoor: null, transplant: null, sow: 2, harvest: 75, spacing: 12, notes: "Plant in blocks, not single rows, for pollination." },
    { name: "Eggplant", type: "Vegetable", sun: "Full sun", water: "High", indoor: 8, transplant: 3, sow: null, harvest: 75, spacing: 18, notes: "Needs the hottest spot you have." },
    { name: "Radish", type: "Vegetable", sun: "Partial shade", water: "Medium", indoor: null, transplant: null, sow: -2, harvest: 28, spacing: 2, notes: "Fastest payoff in the garden." },
    { name: "Beet", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: null, transplant: null, sow: -2, harvest: 55, spacing: 4, notes: "Eat the thinnings as greens." },
    { name: "Pumpkin", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: 3, transplant: 3, sow: 3, harvest: 100, spacing: 48, notes: "Needs room to roam — or grow vertically." },
    { name: "Watermelon", type: "Vegetable", sun: "Full sun", water: "High", indoor: 4, transplant: 3, sow: null, harvest: 85, spacing: 36, notes: "Cut water as fruit ripens for sweetness." },
    { name: "Brussels Sprouts", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: 6, transplant: 0, sow: null, harvest: 100, spacing: 18, notes: "Best as a fall crop in most zones." },
    { name: "Sweet Potato", type: "Vegetable", sun: "Full sun", water: "Medium", indoor: null, transplant: 4, sow: null, harvest: 110, spacing: 12, notes: "Start slips indoors 6 weeks before transplant." },
    { name: "Basil", type: "Herb", sun: "Full sun", water: "Medium", indoor: 6, transplant: 2, sow: null, harvest: 70, spacing: 12, notes: "Pinch flower buds to keep leaves coming." },
    { name: "Cilantro", type: "Herb", sun: "Partial shade", water: "Medium", indoor: null, transplant: null, sow: 0, harvest: 50, spacing: 8, notes: "Bolts fast — succession sow." },
    { name: "Parsley", type: "Herb", sun: "Partial shade", water: "Medium", indoor: 8, transplant: 1, sow: null, harvest: 75, spacing: 10, notes: "Slow to germinate — be patient." },
    { name: "Dill", type: "Herb", sun: "Full sun", water: "Low", indoor: null, transplant: null, sow: 1, harvest: 60, spacing: 12, notes: "Self-sows freely." },
    { name: "Mint", type: "Herb", sun: "Partial shade", water: "High", indoor: null, transplant: 1, sow: null, harvest: 70, spacing: 18, notes: "Grow in a pot — it will take over beds." },
    { name: "Rosemary", type: "Herb", sun: "Full sun", water: "Low", indoor: null, transplant: 2, sow: null, harvest: 90, spacing: 24, notes: "Perennial in zones 8+; hates wet feet." },
    { name: "Thyme", type: "Herb", sun: "Full sun", water: "Low", indoor: null, transplant: 1, sow: null, harvest: 80, spacing: 12, notes: "Perennial; trim after flowering." },
    { name: "Oregano", type: "Herb", sun: "Full sun", water: "Low", indoor: null, transplant: 1, sow: null, harvest: 80, spacing: 12, notes: "Perennial; flavor peaks before bloom." },
    { name: "Chives", type: "Herb", sun: "Full sun", water: "Medium", indoor: null, transplant: 0, sow: null, harvest: 60, spacing: 8, notes: "Perennial; divide clumps every few years." },
    { name: "Sage", type: "Herb", sun: "Full sun", water: "Low", indoor: null, transplant: 1, sow: null, harvest: 85, spacing: 18, notes: "Perennial; don't overwater." },
    { name: "Marigold", type: "Flower", sun: "Full sun", water: "Medium", indoor: 6, transplant: 1, sow: null, harvest: 60, spacing: 10, notes: "Great pest deterrent near vegetables." },
    { name: "Sunflower", type: "Flower", sun: "Full sun", water: "Medium", indoor: null, transplant: null, sow: 2, harvest: 75, spacing: 12, notes: "Kids love them; plant along the north edge." },
    { name: "Zinnia", type: "Flower", sun: "Full sun", water: "Medium", indoor: 4, transplant: 2, sow: null, harvest: 65, spacing: 12, notes: "Cut-and-come-again blooms all summer." },
    { name: "Nasturtium", type: "Flower", sun: "Full sun", water: "Low", indoor: null, transplant: null, sow: 2, harvest: 55, spacing: 12, notes: "Edible flowers; trap crop for aphids." },
    { name: "Lavender", type: "Flower", sun: "Full sun", water: "Low", indoor: null, transplant: 2, sow: null, harvest: 90, spacing: 18, notes: "Perennial; needs sharp drainage." }
  ];

  var WATER_INTERVAL = { "Low": 7, "Medium": 4, "High": 2 }; // days between waterings
  var FERTILIZE_DAYS = 21;

  return {
    ZONE_FROST: ZONE_FROST,
    PLANTS: PLANTS,
    WATER_INTERVAL: WATER_INTERVAL,
    FERTILIZE_DAYS: FERTILIZE_DAYS
  };
});

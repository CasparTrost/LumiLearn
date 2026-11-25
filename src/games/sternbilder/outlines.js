/**
 * Sternbilder: the dot-to-dot outlines, the level plan and the fitting of an
 * outline into the sky. No React in here, so it can be tested on its own
 * (tests/unit/sternbilder.test.js).
 *
 * An outline is a closed line through `pts`, traced from the silhouette of
 * one of the app's illustrated pictures (public/sprites/emoji), so the
 * picture that fades in at the end sits exactly on the line the child drew.
 * Units: 0..100 across the picture's square; `rot` turns the picture (and
 * its points are given already turned) so that a tall thing like the rocket
 * can stand upright on a phone and lie on its side on a phone held sideways.
 * `box` is what has to fit into the sky: the points and the silhouette.
 *
 * The points were chosen so that the bare line is still recognisable and
 * no two stars sit closer than a fingertip: by hand for the small numbers
 * (five to ten points: the corners that make a house a house), by a search
 * for the best polygon on the contour for fifteen and twenty.
 */
import { LINES, line } from '../../lib/lumiLines.js'

export const OUTLINES = [
  // <outlines>
  { id: 'house5', pic: 'house', name: 'Haus', art: '🏠', rot: 0, box: [3.5, 8, 96, 91.5], pts: [[51, 8], [92, 48], [86, 90], [16, 90], [8, 48]] },
  { id: 'gem5', pic: 'gem', name: 'Diamant', art: '💎', rot: 0, box: [3.5, 8.5, 96, 90.5], pts: [[21.5, 14], [68, 10], [96, 36], [50.5, 90.5], [3.5, 35.5]] },
  { id: 'star5', pic: 'star', name: 'Stern', art: '⭐', rot: 0, box: [3.5, 6, 96, 93.5], pts: [[52.5, 6.5], [75, 93.5], [4.5, 44.5], [96, 42.5], [22, 93]] },
  { id: 'pencil5', pic: 'pencil', name: 'Stift', art: '✏', rot: 0, box: [4, 3, 96, 95.5], pts: [[4, 95], [9, 65], [77, 3], [96, 22], [27, 90]] },
  { id: 'flag5', pic: 'flag', name: 'Fahne', art: '🚩', rot: 0, box: [12.5, 3.5, 87, 96], pts: [[20, 5], [87, 37], [25, 60], [31, 93], [13, 93]] },
  { id: 'bolt7', pic: 'bolt', name: 'Blitz', art: '⚡', rot: 0, box: [19.5, 3.5, 80.5, 96], pts: [[64.5, 3.5], [52.5, 38.5], [80, 39.5], [28, 96], [44, 59.5], [20.5, 55.5], [38.5, 31.5]] },
  { id: 'fish7', pic: 'fish', name: 'Fisch', art: '🐟', rot: 0, box: [3.5, 15.5, 96, 84], pts: [[4, 48], [46, 16], [77, 43.5], [93.5, 34.5], [96, 69], [74.5, 63], [46, 83.5]] },
  { id: 'moon7', pic: 'moon', name: 'Mond', art: '🌙', rot: 0, box: [6.5, 3.5, 93, 95.5], pts: [[56.5, 3.5], [48.5, 40.5], [63, 66], [93, 69.5], [53.5, 95.5], [6.5, 51.5], [27.5, 11.5]] },
  { id: 'banana7', pic: 'banana', name: 'Banane', art: '🍌', rot: 0, box: [7, 3.5, 92.5, 96], pts: [[74.5, 3.5], [91.5, 36.5], [84.5, 70.5], [43.5, 96], [7, 79], [47, 54.5], [67.5, 24]] },
  { id: 'crown7', pic: 'crown', name: 'Krone', art: '👑', rot: 0, box: [3.5, 12.5, 95.5, 87], pts: [[47.5, 12.5], [81, 41.5], [94.5, 24.5], [86.5, 79], [12.5, 79.5], [8, 22], [20.5, 45]] },
  { id: 'drop7', pic: 'drop', name: 'Tropfen', art: '💧', rot: 0, box: [18.5, 3.5, 80.5, 96], pts: [[52, 4.5], [72.5, 40.5], [80.5, 70], [68, 90], [40, 94.5], [18.5, 68], [25, 44.5]] },
  { id: 'hat8', pic: 'hat', name: 'Hut', art: '🎩', rot: 0, box: [3.5, 6.5, 96, 92.5], pts: [[17.5, 13.5], [83, 13.5], [79.5, 64], [94, 79.5], [68, 91.5], [32.5, 91.5], [4.5, 78], [20, 64]] },
  { id: 'heart8', pic: 'heart', name: 'Herz', art: '❤', rot: 0, box: [3.5, 8, 96, 91.5], pts: [[50, 21], [77.5, 8.5], [96, 32], [80.5, 66], [49.5, 91.5], [13.5, 60.5], [4.5, 27], [20, 9.5]] },
  { id: 'moon8', pic: 'moon', name: 'Mond', art: '🌙', rot: 0, box: [6.5, 3.5, 93, 95.5], pts: [[56.5, 3.5], [47, 36], [54, 57.5], [93, 69.5], [70, 92.5], [31, 91], [6.5, 51.5], [27.5, 11.5]] },
  { id: 'mushroom8', pic: 'mushroom', name: 'Pilz', art: '🍄', rot: 0, box: [7.5, 3.5, 91.5, 95.5], pts: [[7.5, 52.5], [31.5, 10.5], [70, 10.5], [90.5, 55.5], [66.5, 67], [65.5, 91.5], [37.5, 93.5], [33, 66.5]] },
  { id: 'shirt8', pic: 'shirt', name: 'T-Shirt', art: '👕', rot: 0, box: [3.5, 8, 96, 91], pts: [[29.5, 11], [63, 8], [96, 42.5], [78, 53.5], [78.5, 87], [21, 86], [22, 54], [3.5, 42.5]] },
  { id: 'fish8', pic: 'fish', name: 'Fisch', art: '🐟', rot: 0, box: [3.5, 15.5, 96, 84], pts: [[4, 48], [27.5, 27.5], [52.5, 15.5], [77, 43.5], [93.5, 34.5], [96, 69], [74.5, 63], [46, 83.5]] },
  { id: 'crown8', pic: 'crown', name: 'Krone', art: '👑', rot: 0, box: [3.5, 12.5, 95.5, 87], pts: [[47.5, 12.5], [77, 43], [94.5, 24.5], [86.5, 79], [52, 87], [12.5, 79.5], [8, 22], [20.5, 45]] },
  { id: 'star10', pic: 'star', name: 'Stern', art: '⭐', rot: 0, box: [3.5, 6, 96, 93.5], pts: [[52.5, 6.5], [68, 31.5], [96, 42.5], [81, 59], [75, 93.5], [49.5, 81.5], [22, 93], [22.5, 63], [4.5, 44.5], [33, 31.5]] },
  { id: 'shirt10', pic: 'shirt', name: 'T-Shirt', art: '👕', rot: 0, box: [3.5, 8, 96, 91], pts: [[37, 8], [63, 8], [83, 17.5], [96, 42.5], [78, 53.5], [78.5, 87], [21, 86], [22, 54], [3.5, 42.5], [15.5, 20]] },
  { id: 'heart10', pic: 'heart', name: 'Herz', art: '❤', rot: 0, box: [3.5, 8, 96, 91.5], pts: [[50, 21], [66.5, 8.5], [92.5, 20.5], [90.5, 52.5], [72.5, 74], [49.5, 91.5], [29.5, 77], [8.5, 53], [7, 21], [25, 8]] },
  { id: 'fish10', pic: 'fish', name: 'Fisch', art: '🐟', rot: 0, box: [3.5, 15.5, 96, 84], pts: [[4, 48], [17.5, 32.5], [41, 18], [61, 23], [71.5, 40], [93.5, 34.5], [96, 69], [74.5, 63], [54.5, 74], [23, 72]] },
  { id: 'moon10', pic: 'moon', name: 'Mond', art: '🌙', rot: 0, box: [6.5, 3.5, 93, 95.5], pts: [[56.5, 3.5], [47, 36], [54, 57.5], [93, 69.5], [81, 86.5], [53.5, 95.5], [26, 88], [7.5, 61], [10, 33], [27.5, 11.5]] },
  { id: 'castle10', pic: 'castle', name: 'Schloss', art: '🏰', rot: 0, box: [5.5, 3.5, 93.5, 96], pts: [[55, 4.5], [64.5, 53.5], [81, 30.5], [93.5, 51], [87, 95], [11, 94.5], [5.5, 52], [18.5, 29.5], [35, 53.5], [37, 29.5]] },
  { id: 'dino10', pic: 'dino', name: 'Dino', art: '🦕', rot: 0, box: [3.5, 6.5, 96, 93], pts: [[22, 8.5], [35, 47.5], [54, 44], [70, 54], [92, 85.5], [62, 92.5], [41, 92.5], [23, 90.5], [17, 40], [4, 15]] },
  { id: 'mushroom10', pic: 'mushroom', name: 'Pilz', art: '🍄', rot: 0, box: [7.5, 3.5, 91.5, 95.5], pts: [[7.5, 52.5], [14.5, 30.5], [34.5, 8.5], [63.5, 6.5], [83, 27], [90.5, 55.5], [66.5, 67], [65.5, 91.5], [37.5, 93.5], [33, 66.5]] },
  { id: 'tower10', pic: 'tower', name: 'Turm', art: '🗼', rot: 0, box: [24.5, 3.5, 74.5, 95.5], pts: [[50, 3.5], [57, 30], [58, 51.5], [63, 74], [73.5, 95.5], [49, 85], [26.5, 95.5], [36, 76], [41.5, 54.5], [43.5, 28.5]] },
  { id: 'guitar10v', pic: 'guitar', name: 'Gitarre', art: '🎸', rot: -45, box: [26, -11.9, 70.9, 101.3], pts: [[53.9, -11.2], [53.9, 55.3], [67.3, 51.1], [70.2, 92.8], [58.5, 100.9], [36.2, 99.1], [26.3, 89.2], [30.2, 40.8], [44, 48.2], [43.3, -5.5]] },
  { id: 'duck10', pic: 'duck', name: 'Ente', art: '🦆', rot: 0, box: [9.5, 3.5, 90, 96], pts: [[34.5, 4], [50.5, 10], [51.5, 40], [90, 49.5], [82.5, 65.5], [60, 96], [31, 90.5], [17, 55.5], [30, 32.5], [10, 28.5]] },
  { id: 'swan10', pic: 'swan', name: 'Schwan', art: '🦢', rot: 0, box: [3.5, 8.5, 96, 90.5], pts: [[20.5, 10], [40.5, 15], [40.5, 42], [85.5, 45], [85.5, 79.5], [66.5, 89], [25.5, 88.5], [8.5, 71.5], [27.5, 31], [4, 37]] },
  { id: 'balloon10', pic: 'balloon', name: 'Luftballon', art: '🎈', rot: 0, box: [22.5, 3.5, 77, 96], pts: [[48.5, 3.5], [72.5, 16.5], [76.5, 37], [69, 55], [59, 63.5], [66.5, 96], [47, 71], [29, 52], [22.5, 33.5], [32.5, 10]] },
  { id: 'umbrella10', pic: 'umbrella', name: 'Schirm', art: '☂', rot: 0, box: [4, 3, 96, 95.5], pts: [[58, 3], [80, 17], [93, 39], [96, 59], [64, 57], [50, 95], [36, 82], [42, 54], [4, 46], [23, 20]] },
  { id: 'rocket10', pic: 'rocket', name: 'Rakete', art: '🚀', rot: 0, box: [3.5, 4, 96, 95.5], pts: [[94, 5], [86, 46], [69, 75], [48, 95], [35, 82], [4, 95], [24, 60], [5, 56], [19, 36], [53, 14]] },
  { id: 'castle15', pic: 'castle', name: 'Schloss', art: '🏰', rot: 0, box: [5.5, 3.5, 93.5, 96], pts: [[9.5, 93.5], [9.5, 67.5], [5.5, 51.5], [20, 22], [35, 53.5], [35.5, 32.5], [49.5, 3.5], [64, 32.5], [64, 54], [80.5, 22], [93.5, 50.5], [89.5, 69], [90.5, 92.5], [58.5, 94.5], [36, 95]] },
  { id: 'rocket15', pic: 'rocket', name: 'Rakete', art: '🚀', rot: 0, box: [3.5, 4, 96, 95.5], pts: [[94, 4.5], [95, 23.5], [87.5, 43.5], [63, 85], [47, 95], [37, 79], [24, 94], [5, 95.5], [6.5, 74.5], [22, 63], [5, 54.5], [16, 38.5], [39, 27.5], [54, 14], [74, 5.5]] },
  { id: 'rocket15v', pic: 'rocket', name: 'Rakete', art: '🚀', rot: -45, box: [17.8, -13.3, 83.9, 114], pts: [[48.9, -13.3], [63.1, -0.6], [70.5, 14.6], [83.9, 67], [79.7, 83.9], [66.3, 71.2], [63.1, 98.4], [50.4, 114], [35.9, 97.4], [34.4, 74], [22.1, 85.7], [17.8, 63.8], [27, 46.1], [27.4, 22.4], [38, -2.3]] },
  { id: 'rocket15h', pic: 'rocket', name: 'Rakete', art: '🚀', rot: 45, box: [-14, 17.8, 113.3, 83.9], pts: [[36.2, 17.8], [53.9, 27], [77.6, 27.4], [102.3, 38], [113.3, 48.9], [100.6, 63.1], [85.4, 70.5], [33, 83.9], [16.1, 79.7], [28.8, 66.3], [1.6, 63.1], [-14, 50.4], [2.6, 35.9], [26, 34.4], [14.3, 22.1]] },
  { id: 'crown15', pic: 'crown', name: 'Krone', art: '👑', rot: 0, box: [3.5, 12.5, 95.5, 87], pts: [[50.5, 12.5], [61, 43], [71, 22], [78, 44.5], [92, 22], [89.5, 64.5], [85, 80.5], [60, 87], [34, 86.5], [13, 80], [9, 63], [8, 22], [21, 44.5], [28.5, 22], [37, 43]] },
  { id: 'tulip15', pic: 'tulip', name: 'Tulpe', art: '🌷', rot: 0, box: [17.5, 3.5, 82, 96], pts: [[55.5, 7], [69.5, 8.5], [72, 37.5], [66, 49.5], [54, 57.5], [81.5, 58.5], [71, 82.5], [52, 96], [35, 88.5], [22.5, 72.5], [19, 53.5], [46.5, 69], [32.5, 48.5], [27, 35], [30, 8]] },
  { id: 'bat15', pic: 'bat', name: 'Fledermaus', art: '🦇', rot: 0, box: [3.5, 22.5, 96, 76.5], pts: [[61.5, 22.5], [62.5, 48], [72.5, 29], [88.5, 37], [95.5, 47], [68, 61], [59, 73], [45, 74], [40, 63], [3.5, 53], [8.5, 42], [24.5, 31], [37, 49], [34.5, 24.5], [50.5, 32.5]] },
  { id: 'cat15', pic: 'cat', name: 'Katze', art: '🐱', rot: 0, box: [15.5, 3.5, 83.5, 95.5], pts: [[58, 4.5], [60.5, 35.5], [53.5, 47], [67.5, 61.5], [74, 75.5], [75, 50.5], [81.5, 64.5], [72, 89.5], [59.5, 95], [28.5, 94.5], [28, 76], [23, 53], [18, 37.5], [19.5, 8.5], [43, 10.5]] },
  { id: 'dino15', pic: 'dino', name: 'Dino', art: '🦕', rot: 0, box: [3.5, 6.5, 96, 93], pts: [[21.5, 8], [34.5, 48], [51.5, 43.5], [67.5, 51.5], [79, 69.5], [96, 80.5], [80.5, 86.5], [64.5, 92.5], [50, 83], [36.5, 93], [20, 88.5], [22, 71.5], [17.5, 55.5], [17.5, 36.5], [4.5, 14.5]] },
  { id: 'duck15', pic: 'duck', name: 'Ente', art: '🦆', rot: 0, box: [9.5, 3.5, 90, 96], pts: [[44.5, 5], [53.5, 19], [44.5, 39], [64.5, 42.5], [82.5, 43.5], [87, 59.5], [71.5, 76.5], [65, 91], [49.5, 94.5], [32.5, 91], [27, 73.5], [17, 57.5], [30, 31.5], [12, 30], [28.5, 7]] },
  { id: 'giraffe15', pic: 'giraffe', name: 'Giraffe', art: '🦒', rot: 0, box: [31, 3.5, 73.5, 95.5], pts: [[51.5, 4.5], [70.5, 11], [72, 32], [61, 36.5], [65, 65.5], [63, 94.5], [52, 95], [50.5, 80], [42.5, 87.5], [34.5, 93], [34.5, 81], [33, 68], [50, 57], [50, 32], [46, 13.5]] },
  { id: 'tower15', pic: 'tower', name: 'Turm', art: '🗼', rot: 0, box: [24.5, 3.5, 74.5, 95.5], pts: [[50, 3.5], [52.5, 16.5], [57, 30], [58, 51.5], [63, 62], [63, 74], [74.5, 95], [63.5, 95.5], [52, 85], [25.5, 95.5], [37, 74], [36.5, 62.5], [42, 53.5], [42.5, 41.5], [43.5, 28.5]] },
  { id: 'cactus15', pic: 'cactus', name: 'Kaktus', art: '🌵', rot: 0, box: [11, 3.5, 88, 96], pts: [[49.5, 3.5], [65.5, 16], [67.5, 56.5], [75.5, 36.5], [88, 49], [81.5, 66], [64, 76.5], [75, 92], [51, 96], [23, 92], [33.5, 74], [13.5, 57.5], [13.5, 35.5], [31.5, 32.5], [35.5, 15]] },
  { id: 'swan15', pic: 'swan', name: 'Schwan', art: '🦢', rot: 0, box: [3.5, 8.5, 96, 90.5], pts: [[30.5, 8.5], [44, 23], [37, 55.5], [51, 45.5], [68, 44], [85.5, 48.5], [94, 66], [80.5, 84], [56.5, 90.5], [25.5, 88.5], [10.5, 78.5], [10.5, 61.5], [30.5, 34.5], [4, 37], [14.5, 14]] },
  { id: 'shark15', pic: 'shark', name: 'Hai', art: '🦈', rot: 0, box: [3.5, 19.5, 95.5, 79.5], pts: [[61.5, 19.5], [59.5, 33.5], [74, 52.5], [94, 37], [86, 61.5], [90, 75.5], [75.5, 72.5], [62, 70], [48.5, 71], [39, 79], [22.5, 63], [9, 48.5], [5.5, 36.5], [20.5, 31], [44.5, 28]] },
  { id: 'leaf15', pic: 'leaf', name: 'Blatt', art: '🍁', rot: 0, box: [7, 4, 92.5, 96], pts: [[48.5, 5], [68, 18.5], [66.5, 34.5], [92.5, 34.5], [86.5, 57], [82.5, 72.5], [64, 81], [46, 93], [48, 76], [31.5, 81.5], [17.5, 73], [13.5, 57.5], [7, 33.5], [26.5, 34.5], [37, 21]] },
  { id: 'guitar15v', pic: 'guitar', name: 'Gitarre', art: '🎸', rot: -45, box: [26, -11.9, 70.9, 101.3], pts: [[54.9, -9.4], [51.8, 16.4], [53.9, 55.3], [68, 51.8], [68.4, 75.5], [70.2, 92.1], [61.3, 100.2], [38.7, 100.2], [26, 87.5], [32.3, 64.1], [28.4, 52.5], [31.3, 39.7], [42.9, 50.7], [44, 38.3], [43.3, -5.5]] },
  { id: 'guitar15h', pic: 'guitar', name: 'Gitarre', art: '🎸', rot: 45, box: [-1.3, 26, 111.9, 70.9], pts: [[12.5, 26], [36.9, 32], [56.7, 29.1], [50, 43.6], [87.1, 44], [96, 40.8], [109.8, 44.7], [110.1, 54.9], [81.5, 51.8], [44.3, 54.2], [48.6, 67.7], [37.3, 67.7], [8.3, 70.5], [-0.2, 60.6], [-0.2, 38.7]] },
  { id: 'plane15', pic: 'plane', name: 'Flugzeug', art: '✈', rot: 0, box: [3.5, 18, 95.5, 81], pts: [[21, 18], [49.5, 31], [72.5, 20.5], [79, 32], [63.5, 38], [75.5, 45], [92.5, 36], [91.5, 62], [56, 63], [67, 81], [40, 66], [23.5, 70.5], [17, 58], [29, 53], [3.5, 27.5]] },
  { id: 'whale15', pic: 'whale', name: 'Wal', art: '🐳', rot: 0, box: [3.5, 11.5, 96, 88], pts: [[22, 13], [51.5, 15], [38.5, 29.5], [52, 38.5], [68, 59], [68.5, 38.5], [96, 45], [79.5, 70.5], [62.5, 87.5], [42.5, 88], [26.5, 86.5], [6.5, 79], [3.5, 57], [9.5, 42], [23, 33]] },
  { id: 'key15v', pic: 'key', name: 'Schlüssel', art: '🔑', rot: -45, box: [22.4, -3, 76.5, 108.3], pts: [[59.9, -1.6], [74.7, 13.2], [75.1, 31.3], [58.1, 49.6], [54.9, 65.6], [68.4, 70.5], [66.6, 82.2], [65.6, 99.5], [42.2, 107.3], [37.6, 96.3], [39, 63.8], [38.7, 47.9], [24.2, 32], [24.5, 12.5], [38, -0.9]] },
  { id: 'key15h', pic: 'key', name: 'Schlüssel', art: '🔑', rot: 45, box: [-8.3, 22.4, 103, 76.5], pts: [[68, 24.2], [87.5, 24.5], [100.9, 38], [101.6, 59.9], [86.8, 74.7], [68.7, 75.1], [50.4, 58.1], [34.4, 54.9], [29.5, 68.4], [17.8, 66.6], [0.5, 65.6], [-7.3, 42.2], [3.7, 37.6], [36.2, 39], [52.1, 38.7]] },
  { id: 'giraffe20', pic: 'giraffe', name: 'Giraffe', art: '🦒', rot: 0, box: [31, 3.5, 73.5, 95.5], pts: [[51, 5], [59, 10], [69, 10], [72.5, 31.5], [60.5, 35], [62.5, 45], [65, 69], [63, 81], [63.5, 94], [53.5, 95.5], [49.5, 79], [44.5, 93.5], [41.5, 84], [34.5, 93.5], [35, 77.5], [33.5, 67.5], [50, 56.5], [50.5, 36.5], [48.5, 23.5], [43.5, 15]] },
  { id: 'tower20', pic: 'tower', name: 'Turm', art: '🗼', rot: 0, box: [24.5, 3.5, 75, 95.5], pts: [[49.5, 3.5], [53.5, 20], [57, 28.5], [57.5, 41], [58, 52], [63, 60.5], [62, 71.5], [68.5, 85.5], [75, 94.5], [64, 95.5], [49.5, 84.5], [35, 95.5], [25, 95.5], [33.5, 81.5], [38, 71.5], [36.5, 62], [41.5, 54], [42.5, 41], [43, 30], [48, 12.5]] },
  { id: 'cactus20', pic: 'cactus', name: 'Kaktus', art: '🌵', rot: 0, box: [10.5, 3.5, 87.5, 96], pts: [[49.5, 3.5], [63, 12.5], [67.5, 28], [66, 57.5], [71, 42], [85, 38.5], [86.5, 53.5], [80, 67], [64, 77], [75.5, 91.5], [54.5, 95.5], [39.5, 94], [22.5, 91.5], [34, 75.5], [14, 58], [10.5, 44], [17.5, 31], [32, 42], [31.5, 27], [37, 12.5]] },
  { id: 'tulip20', pic: 'tulip', name: 'Tulpe', art: '🌷', rot: 0, box: [17.5, 3.5, 82, 96], pts: [[45, 6.5], [69.5, 8.5], [72, 33.5], [69, 46], [54.5, 55.5], [54, 75], [64, 62], [81, 53], [76.5, 74], [65.5, 88], [49.5, 96], [32.5, 86], [21.5, 69.5], [19, 53.5], [33, 61], [46.5, 66], [43, 55], [30.5, 46.5], [27, 35.5], [29.5, 8.5]] },
  { id: 'bat20', pic: 'bat', name: 'Fledermaus', art: '🦇', rot: 0, box: [3.5, 22.5, 96, 76.5], pts: [[62, 23], [63, 35], [61, 49], [72.5, 29], [88.5, 37], [95, 46], [86, 52.5], [73.5, 59], [62.5, 61.5], [59.5, 72.5], [45.5, 74.5], [39.5, 62.5], [27.5, 62], [15.5, 58], [4.5, 49.5], [13, 37.5], [26, 30], [34.5, 47], [35.5, 23], [48, 32.5]] },
  { id: 'shark20', pic: 'shark', name: 'Hai', art: '🦈', rot: 0, box: [3.5, 19.5, 95.5, 79.5], pts: [[61.5, 19.5], [60, 35.5], [68.5, 44.5], [75, 53], [93.5, 37], [91.5, 47], [87.5, 57], [86.5, 76], [76, 64.5], [74.5, 74.5], [65.5, 69], [47, 71], [38.5, 79], [30.5, 68], [19.5, 61], [9, 48.5], [3.5, 38.5], [15.5, 32.5], [25.5, 30], [44.5, 28]] },
  { id: 'plane20', pic: 'plane', name: 'Flugzeug', art: '✈', rot: 0, box: [3.5, 18, 95.5, 81], pts: [[14, 19], [26, 19.5], [49, 31], [64, 24.5], [74.5, 31], [84.5, 24.5], [65, 39.5], [76, 45], [91, 35], [89, 47.5], [92, 61.5], [70, 63], [55.5, 62.5], [68.5, 79.5], [56.5, 76.5], [42.5, 65], [23, 70.5], [17, 58.5], [29, 52.5], [4, 29]] },
  { id: 'dino20', pic: 'dino', name: 'Dino', art: '🦕', rot: 0, box: [3.5, 6.5, 96, 93], pts: [[17.5, 6.5], [27, 16], [30.5, 47], [45.5, 44], [58.5, 45.5], [69.5, 53.5], [80, 71.5], [95, 74.5], [90, 86.5], [77, 84.5], [67, 92.5], [53.5, 90.5], [47.5, 79], [40, 92.5], [22, 90.5], [22, 70], [17.5, 55], [17, 42], [18.5, 28], [3.5, 20.5]] },
  { id: 'duck20', pic: 'duck', name: 'Ente', art: '🦆', rot: 0, box: [9.5, 3.5, 90, 96], pts: [[45, 5], [53.5, 18.5], [45, 39.5], [59, 40.5], [71, 45.5], [83, 44], [89, 55], [81, 68], [64, 81.5], [62, 94], [49, 94.5], [27.5, 88], [41.5, 81.5], [26.5, 73], [18.5, 63], [18.5, 50], [30.5, 32], [9.5, 28], [20.5, 21.5], [29.5, 6]] },
  { id: 'cat20', pic: 'cat', name: 'Katze', art: '🐱', rot: 0, box: [15.5, 3.5, 83.5, 95.5], pts: [[23, 3.5], [34.5, 11], [58.5, 5], [60, 38], [53, 46], [63, 56.5], [73.5, 73.5], [72.5, 63.5], [72.5, 53.5], [82.5, 52.5], [82.5, 80.5], [76, 88], [63.5, 94.5], [38.5, 95.5], [26, 93.5], [29, 81.5], [22.5, 54.5], [25.5, 44.5], [18, 38], [19, 13]] },
  { id: 'trex20', pic: 'trex', name: 'T-Rex', art: '🦖', rot: 0, box: [3.5, 7, 95.5, 92.5], pts: [[23.5, 7], [37.5, 7.5], [46.5, 17], [49.5, 35], [65.5, 40], [81, 55], [95.5, 53.5], [89, 66.5], [72, 74], [72.5, 87], [60.5, 92.5], [57, 75], [48, 89], [35, 88], [41.5, 75], [35.5, 61], [19, 56.5], [31, 42.5], [10.5, 42], [4, 21.5]] },
  { id: 'leaf20', pic: 'leaf', name: 'Blatt', art: '🍁', rot: 0, box: [7, 4, 92.5, 96], pts: [[49.5, 4], [69, 23.5], [65.5, 41.5], [75.5, 32.5], [92.5, 33.5], [85.5, 57.5], [84.5, 72], [73.5, 75.5], [61, 80], [51, 85.5], [47.5, 96], [46.5, 75.5], [36.5, 80.5], [13.5, 71.5], [21, 63.5], [9.5, 54], [8, 32.5], [34, 37.5], [30.5, 23.5], [41.5, 16]] },
  { id: 'puzzle20', pic: 'puzzle', name: 'Puzzleteil', art: '🧩', rot: 0, box: [3.5, 4, 96, 95], pts: [[45, 4], [62.5, 16.5], [75.5, 5], [89.5, 15.5], [82.5, 33], [96, 47], [84.5, 62.5], [70, 54], [60.5, 66], [72.5, 79], [56, 95], [36, 82], [24, 94], [10, 83.5], [18.5, 66.5], [3.5, 53], [11.5, 40], [26.5, 39.5], [41, 34.5], [30.5, 18]] },
  { id: 'castle20', pic: 'castle', name: 'Schloss', art: '🏰', rot: 0, box: [5.5, 3.5, 93.5, 96], pts: [[52.5, 4.5], [55.5, 21], [64, 32.5], [61, 54], [70.5, 47], [83.5, 22.5], [84.5, 37], [93.5, 49.5], [90.5, 89], [81, 96], [59, 94.5], [22, 96], [9.5, 93.5], [9.5, 66.5], [5.5, 52.5], [22.5, 22.5], [22.5, 36], [37.5, 54], [35.5, 32], [43, 22.5]] },
  { id: 'whale20', pic: 'whale', name: 'Wal', art: '🐳', rot: 0, box: [3.5, 11.5, 96, 88], pts: [[26, 11.5], [44, 11.5], [53, 20], [43.5, 33.5], [55.5, 41.5], [69.5, 60], [70.5, 36], [83, 44], [95, 41.5], [93, 53.5], [72, 79], [62.5, 87.5], [38.5, 88], [26.5, 86.5], [6.5, 79], [3.5, 59], [6, 47], [15, 36.5], [33, 27.5], [21.5, 23]] },
  { id: 'rocket20v', pic: 'rocket', name: 'Rakete', art: '🚀', rot: -45, box: [17.8, -13.3, 83.9, 114], pts: [[47.5, -12.6], [59.2, -5.9], [70.5, 13.9], [74.7, 29.5], [75.1, 43.3], [83.9, 63.4], [78.6, 85], [67, 71.2], [64.5, 87.1], [62, 100.9], [50.7, 113.6], [36.9, 99.9], [35.9, 86.8], [33.7, 74], [22.4, 86.1], [17.8, 63.8], [26.7, 45.1], [26.7, 26], [30.9, 11.8], [38, -2.3]] },
  { id: 'rocket20h', pic: 'rocket', name: 'Rakete', art: '🚀', rot: 45, box: [-14, 17.8, 113.3, 83.9], pts: [[36.2, 17.8], [54.9, 26.7], [74, 26.7], [88.2, 30.9], [102.3, 38], [112.6, 47.5], [105.9, 59.2], [86.1, 70.5], [70.5, 74.7], [56.7, 75.1], [36.6, 83.9], [15, 78.6], [28.8, 67], [12.9, 64.5], [-0.9, 62], [-13.6, 50.7], [0.1, 36.9], [13.2, 35.9], [26, 33.7], [13.9, 22.4]] },
  { id: 'rocket20', pic: 'rocket', name: 'Rakete', art: '🚀', rot: 0, box: [3.5, 4, 96, 95.5], pts: [[92.5, 4], [96, 17], [90, 39], [82, 53], [72.5, 63], [64.5, 83.5], [45.5, 95], [47, 77], [34, 86.5], [22.5, 94.5], [5.5, 95.5], [5.5, 76], [14, 66], [21.5, 55.5], [5, 56], [17.5, 37], [37, 30], [50.5, 16.5], [63.5, 9.5], [78.5, 4.5]] },
  { id: 'guitar20v', pic: 'guitar', name: 'Gitarre', art: '🎸', rot: -45, box: [26, -11.9, 70.9, 101.3], pts: [[54.9, -10.1], [55.3, 4.4], [51.8, 15.7], [52.5, 33.4], [54.2, 55.7], [67.7, 51.4], [66.6, 72.3], [70.9, 84.3], [66.6, 97], [53.9, 101.3], [38.7, 100.2], [26, 87.5], [32.3, 64.1], [28.4, 52.5], [32.3, 39.4], [39.4, 50], [44, 40.5], [44, 23.5], [41.5, 2.6], [44.3, -8.7]] },
  { id: 'guitar20h', pic: 'guitar', name: 'Gitarre', art: '🎸', rot: 45, box: [-1.3, 26, 111.9, 70.9], pts: [[17.5, 26], [32.7, 32], [52.5, 28.4], [61, 32.7], [50.4, 44], [85.4, 43.6], [96.3, 41.2], [109.4, 44.3], [111.5, 53.5], [93.5, 54.6], [80.1, 51.8], [62.7, 52.8], [44.3, 54.2], [49.3, 67], [26, 67.7], [16.4, 70.9], [5.5, 69.1], [-0.2, 60.6], [-0.2, 39.4], [5.8, 28.4]] },
  { id: 'carrot20v', pic: 'carrot', name: 'Möhre', art: '🥕', rot: -45, box: [23.5, -5.5, 70.9, 111.9], pts: [[46.8, -5.5], [54.9, 4.7], [67.7, 5.5], [67.7, 21], [57.1, 28.8], [67, 37.3], [70.9, 50.4], [69.8, 66.3], [66.3, 83.9], [60.3, 102], [50.4, 111.9], [41.2, 102.7], [35.2, 88.9], [29.8, 73], [25.3, 52.1], [27, 39.7], [35.9, 30.2], [25.6, 22.1], [24.9, 9.3], [36.6, 4]] },
  { id: 'key20v', pic: 'key', name: 'Schlüssel', art: '🔑', rot: -45, box: [22.4, -3, 76.5, 108.3], pts: [[52.8, -3], [64.1, 0.5], [74.7, 13.2], [75.1, 31.3], [68, 40.5], [58.1, 48.9], [54.9, 63.4], [69.1, 73.3], [59.2, 82.5], [67, 91.7], [60.6, 102.3], [46.1, 108.3], [37.6, 99.9], [38, 86.1], [39, 64.5], [38.7, 47.2], [27, 36.9], [22.4, 23.1], [27.7, 7.2], [38, -0.9]] },
  { id: 'key20h', pic: 'key', name: 'Schlüssel', art: '🔑', rot: 45, box: [-8.3, 22.4, 103, 76.5], pts: [[79.7, 22.4], [94.5, 28.8], [101.6, 39.4], [101.6, 59.2], [94.5, 69.8], [82.5, 76.2], [68.7, 75.1], [59.2, 67.7], [51.8, 58.1], [34.4, 54.9], [27.4, 69.1], [13.2, 62.7], [2.3, 66.6], [-2, 56], [-8.3, 44.7], [1.6, 37.6], [30.2, 38.7], [41.9, 39.7], [54.9, 37.3], [67.7, 24.5]] },
  // </outlines>
]

const slug = w => w.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
/** Lumi's recorded word for a picture ("Haus."), or null. */
export const pictureWord = o => (LINES[`wort/${slug(o.name)}`] ? line(`wort/${slug(o.name)}`) : null)

// ── Levels ────────────────────────────────────────────────────────────────

/** a, a±step, … b (both ends included) */
export function count(a, b, step = 1) {
  const out = []
  if (a <= b) for (let v = a; v <= b; v += step) out.push(v)
  else for (let v = a; v >= b; v -= step) out.push(v)
  return out
}

// Things that can fly off into the night sky: the pictures of the countdown level
const FLYERS = ['rocket', 'balloon', 'duck', 'swan', 'star', 'umbrella', 'moon']

/**
 * What each level asks for. `numbers` are the stars of one picture in the
 * order they are to be connected; `ghost` is how strongly the picture shows
 * through from the start (0 = a surprise; a faint one where the line of
 * ten and fifteen stars jumps across the picture); `kind` names the
 * counting, for Lumi's one sentence at the start; `launch`: the finished
 * picture takes off into the night (the rocket with a launch, the others
 * each in their own way: see NumbersGame, DRIFT).
 */
const PLAN = [
  { rounds: 4, numbers: count(1, 5),  ghost: 0.26, first: 'house' }, // the very first picture: nothing crosses
  { rounds: 4, numbers: count(1, 7),  ghost: 0.2 },
  { rounds: 4, numbers: count(1, 10), ghost: 0.13 },
  { rounds: 5, numbers: count(1, 10), ghost: 0.09 },
  { rounds: 4, numbers: count(1, 15), ghost: 0.07 },
  { rounds: 5, numbers: count(1, 15) },
  { rounds: 4, numbers: count(1, 20) },
  { rounds: 4, numbers: count(10, 1), kind: 'back', launch: true, first: 'rocket', only: FLYERS },
  { rounds: 4, numbers: count(2, 20, 2), kind: 'twos' },
  { rounds: 3, numbers: count(5, 40, 5), kind: 'fives',
    last: { numbers: count(20, 1), kind: 'back', launch: true, first: 'rocket' } },
]

/** The pictures of a level, in order: [{ numbers, ghost, kind, launch, first, only }] */
export function roundsFor(level) {
  const p = PLAN[Math.max(1, Math.min(PLAN.length, level)) - 1]
  const one = { numbers: p.numbers, ghost: p.ghost ?? 0, kind: p.kind ?? 'up', launch: !!p.launch, only: p.only }
  const list = Array.from({ length: p.rounds }, (_, i) => ({ ...one, first: i === 0 ? p.first : undefined }))
  if (p.last) list.push({ ghost: 0, kind: 'up', launch: false, ...p.last })
  return list
}

// ── Fitting ───────────────────────────────────────────────────────────────

/** Stars are never closer than this on a phone held upright (px). */
export const MIN_GAP = 60

const gaps = new Map()
/** The smallest distance between two stars of an outline, in its units. */
export function minGap(o) {
  if (!gaps.has(o.id)) {
    let d = Infinity
    for (let i = 0; i < o.pts.length; i++) for (let j = i + 1; j < o.pts.length; j++) d = Math.min(d, Math.hypot(o.pts[i][0] - o.pts[j][0], o.pts[i][1] - o.pts[j][1]))
    gaps.set(o.id, d)
  }
  return gaps.get(o.id)
}

/**
 * Where an outline goes in a sky of w × h px (the room for star centres):
 * as large as fits, centred. A point [x, y] lands at ox + x·scale, oy + y·scale.
 */
export function fitOutline(o, w, h, maxScale = 6.5) {
  const [x0, y0, x1, y1] = o.box
  const scale = Math.max(0.1, Math.min(w / (x1 - x0), h / (y1 - y0), maxScale))
  return { scale, ox: (w - (x1 - x0) * scale) / 2 - x0 * scale, oy: (h - (y1 - y0) * scale) / 2 - y0 * scale }
}

/** How far apart the closest two stars of an outline end up in that sky (px). */
export const gapIn = (o, w, h) => minGap(o) * fitOutline(o, w, h).scale

/**
 * The room for star centres inside a sky area: half a star to the edges (the
 * game leaves a few more pixels around the sky). Less on a small screen,
 * where every pixel counts.
 */
export function skyInset(w, h) {
  return Math.min(w, h) < 380 ? 26 : 38
}

/** How much of a sky of w × h the outline's box covers when fitted (0..1). */
export function fill(o, w, h) {
  const [x0, y0, x1, y1] = o.box
  const { scale } = fitOutline(o, w, h)
  return ((x1 - x0) * scale * (y1 - y0) * scale) / (w * h)
}

// one of `list`, the more likely the more `weight` it has
function weighted(list, weight, rnd) {
  const ws = list.map(weight)
  let r = rnd() * ws.reduce((a, b) => a + b, 0)
  for (let i = 0; i < list.length; i++) if ((r -= ws[i]) <= 0) return list[i]
  return list[list.length - 1]
}

function shuffled(list, rnd) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/**
 * The outlines for the pictures of a level in a sky of w × h px (star
 * centres). Of each picture the variant that fits this sky best is taken
 * (the rocket upright or on its side); pictures whose stars would end up
 * closer than MIN_GAP are left out as long as there are enough others, and
 * no picture comes twice in a level. A picture that fills more of this sky
 * is more likely: on a phone held upright a tall one (the tower, the
 * giraffe) stands large in the tall sky, where a square one left half of it
 * empty.
 */
export function pickOutlines(level, w, h, rnd = Math.random) {
  const used = new Set()
  return roundsFor(level).map(round => {
    const n = round.numbers.length
    // the best variant of every picture with n stars
    const best = new Map()
    for (const o of OUTLINES) {
      if (o.pts.length !== n) continue
      const g = gapIn(o, w, h)
      if (!best.has(o.pic) || g > best.get(o.pic).g) best.set(o.pic, { o, g })
    }
    let pool = [...best.values()].filter(c => !round.only || round.only.includes(c.o.pic))
    let pick = round.first && pool.find(c => c.o.pic === round.first)
    if (!pick) {
      const fresh = pool.filter(c => !used.has(c.o.pic))
      if (fresh.length) pool = fresh
      const wide = pool.filter(c => c.g >= MIN_GAP)
      // no room for any: one of the two roomiest (a phone held sideways)
      pick = wide.length ? weighted(wide, c => fill(c.o, w, h) ** 2, rnd) : shuffled([...pool].sort((a, b) => b.g - a.g).slice(0, 2), rnd)[0]
    }
    used.add(pick.o.pic)
    return pick.o
  })
}

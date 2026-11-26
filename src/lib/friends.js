/**
 * Lumis Freunde: four friends a child earns with its stars, a dino, a
 * unicorn, a dragon and a robot. Lumi stays the one who speaks and explains;
 * a friend the child chose comes along and plays with Lumi (beside Lumi on
 * the home screen, celebrating on the results screen, in the game bar where
 * there is room). Nothing is spent and nothing can be lost: at each of the
 * steps in STEPS one more friend may move in, and the CHILD chooses which
 * one. All four come in the end, so no choice is ever wrong.
 *
 * The stars counted are the wardrobe's (the stars ever earned, `starsEver`,
 * see AppContext.jsx profileWardrobeStars).
 *
 * Pictures: public/sprites/friends/<id>-<pose>.webp, 512 × 512, six poses
 * (idle, happy, sad, think, wave, sleep), all of one friend at ONE scale and
 * standing on Lumi's ground line (made by scripts/art/friends-convert.mjs). A
 * standing friend is 0.86 of its square tall, Lumi 0.94 of its own: drawn in
 * a square of the same size, a friend is a little smaller than Lumi.
 *
 * Later the friends will wear the wardrobe's clothes. For that each friend
 * gets anchors per pose like POSES in lib/wardrobe.js (head, face, neck,
 * back, hold: { x, y, rot, w } in pixels of the 512 square) in `poses`
 * below, and friendLayers() draws the worn things over the picture as
 * figureLayers() does for Lumi. Until then `poses` is empty and a friend is
 * its picture only.
 */
export const FRIEND_SIZE = 512
export const FRIEND_POSE_IDS = ['idle', 'happy', 'sad', 'think', 'wave', 'sleep']

export const FRIENDS = [
  // `poses`: anchors per pose for the clothes, to come (see above)
  { id: 'dino', name: 'Dino', color: '#8fd16a', poses: {} },
  { id: 'einhorn', name: 'Einhorn', color: '#f7a8d8', poses: {} },
  { id: 'drache', name: 'Drache', color: '#ff7a45', poses: {} },
  { id: 'roboter', name: 'Roboter', color: '#5fb4ff', poses: {} },
]
export const FRIEND_IDS = FRIENDS.map(f => f.id)
export const FRIEND_BY_ID = Object.fromEntries(FRIENDS.map(f => [f.id, f]))

/**
 * The stars at which one more friend may move in. The first after about two
 * days of play (a good game gives three stars, a day four or five games);
 * then further apart. None lies on a step of the wardrobe
 * (tests/unit/friends.test.js), so a friend and a thing to wear seldom come
 * with the same game; when they do, the friend comes first and the
 * wardrobe keeps its sign on the home screen.
 */
export const STEPS = [20, 70, 155, 260]

/** How many friends the stars have earned (0 … 4). */
export const friendsEarned = stars => STEPS.filter(s => s <= stars).length
/** The stars the next friend needs, or null when all four can be there. */
export const nextStep = stars => STEPS.find(s => s > stars) ?? null
/** The step before the next one: from where its "almost there" fills. */
export const stepBefore = stars => Math.max(0, ...STEPS.filter(s => s <= stars))

/** The friends that moved in, cleaned: known ids, each once, in order. */
export const cleanFriends = list => (Array.isArray(list) ? Array.from(new Set(list.filter(id => FRIEND_BY_ID[id]))) : [])
/** Who comes along: one of the friends that moved in, or nobody. */
export const cleanAlong = (along, friends) => (FRIEND_BY_ID[along] && cleanFriends(friends).includes(along) ? along : null)

/**
 * Friends that may move in now. One at a time: after a friend moved in
 * (`friendWait`) the next one waits for the next game played. A child with
 * many stars from before the friends (an old save) is so given its friends
 * one game apart, each with its own big moment, not four choices in a row.
 */
export function friendsOwed(profile, stars) {
  const owed = friendsEarned(stars) - cleanFriends(profile?.friends).length
  return owed > 0 && !profile?.friendWait ? owed : 0
}
/** The friends still to come (not moved in), in the order of FRIENDS. */
export const friendsToCome = profile => FRIENDS.filter(f => !cleanFriends(profile?.friends).includes(f.id))

/** A fresh child: no friends, nobody along, nothing waiting. */
export const freshFriends = () => ({ friends: [], friendAlong: null, friendWait: false })

// ── Drawing ─────────────────────────────────────────────────────────────────
// Lumi's moods (lib/wardrobe.js lumiPose) to a friend's picture: a friend
// is glad, sad, thinking, sleeping and waving with Lumi. The friends have
// no "hmm" picture: "think" stands for it.
const POSE = {
  happy: 'happy', dance: 'happy', hop: 'happy', eat: 'happy', excited: 'happy', encouraging: 'happy', cheer: 'happy', proud: 'happy', wow: 'happy',
  sad: 'sad',
  oops: 'think', hmm: 'think', think: 'think', thinking: 'think', curious: 'think',
  sleep: 'sleep', sleepy: 'sleep', tired: 'sleep',
  wave: 'wave', hello: 'wave',
}
export const friendPose = mood => POSE[mood] ?? 'idle'
export const friendSrc = (id, pose) => `sprites/friends/${id}-${pose}.webp`

/**
 * Everything drawn for a friend in one pose, bottom to top, in percent of
 * its square (the same shape as figureLayers in lib/wardrobe.js). Today the
 * picture only; the worn things will be added here from the friend's
 * anchors in `poses`.
 */
export function friendLayers(id, pose /* , outfit */) {
  const f = FRIEND_BY_ID[id]
  if (!f) return { layers: [], scale: 1 }
  const p = FRIEND_POSE_IDS.includes(pose) ? pose : 'idle'
  return { layers: [{ kind: 'pose', src: friendSrc(f.id, p) }], scale: 1 }
}

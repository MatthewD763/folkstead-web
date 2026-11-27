// Every word a player reads on the page around the game, in one place, for the
// owner to reword. Each one is a DRAFT of Claude's (November 27, 2026) until the
// owner has worded it: change the text between the quotes and nothing else.
// In anything a player reads the game is Folkstead, people are folks, and a
// stretch is a road. {name} stands for the name in the player's link.
window.FOLKSTEAD_WORDS = {
  // DRAFT: the welcome's heading.
  title: 'Folkstead',

  // DRAFT: the greeting, shown only when the link carries a name.
  hello: 'Hello, {name}.',

  // DRAFT: the welcome's paragraphs, one per line here.
  welcome: [
    'A small puzzle with no clock. Guide your folks home: some become the bridge so the rest can cross.',
    'This is an early test, and you are one of the first to play. There are thirty boards. Stop whenever you like: your stars are kept on this device, so the same link brings you back to them.',
    'Play with a finger or a mouse, whichever suits you.'
  ],

  // DRAFT: the line saying what is recorded, for a player with no name in the link.
  record: 'As you play, the game sends us what happened on each board: how long it took, how many tries, how many stars. No name, no email, nothing about you.',

  // DRAFT: the same line when the link carries a name.
  recordNamed: 'As you play, the game sends us what happened on each board: how long it took, how many tries, how many stars. It also notes the name in your link, {name}, so we know which record is yours. No email, nothing else about you.',

  // DRAFT: the welcome's button, and what it says while the game is still loading.
  play: 'Play',
  loading: 'Loading...',

  // DRAFT: the small tab at the edge of the game that opens the questions.
  tab: 'Done?',

  // DRAFT: the three questions, each answered by one press. A choice's place in
  // its list is what the record keeps beside its words, so add new choices at
  // the end of a list rather than between others.
  questions: [
    {
      ask: 'Why are you stopping?',
      choices: ['Out of time', 'Got stuck', 'Got bored', 'It ran badly', 'I finished']
    },
    {
      ask: 'If Folkstead were gone tomorrow, would you mind?',
      choices: ['A lot', 'A little', 'No']
    },
    {
      ask: 'What do you mostly play?',
      choices: ['Phone puzzles', 'Other phone games', 'Computer or console games', 'Not much']
    }
  ],

  // DRAFT: the button that closes the questions, and the thanks after the last one.
  back: 'Back to the game',
  thanks: 'Thank you. That helps a great deal. Your stars are kept on this device: come back any time.'
};

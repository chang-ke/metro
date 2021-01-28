import C from './async.js'

export const A = 'A', B = () => {
  console.log('B');
};

export {C}

export * from './async.js'

export {default} from './async.js';
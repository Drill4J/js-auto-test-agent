export default msg => ({
  ready: Promise.resolve(),
  startTest: errorStub(msg),
  finishTest: errorStub(msg),
  destroy: () => Promise.resolve(),
});

const errorStub = msg => () => {
  throw new Error(msg);
};

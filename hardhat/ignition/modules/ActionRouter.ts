import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ActionRouterModule = buildModule("ActionRouterModule", (m) => {
  const actionRouter = m.contract("ActionRouter");

  return { actionRouter };
});

export default ActionRouterModule;

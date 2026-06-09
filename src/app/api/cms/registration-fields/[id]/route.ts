import { createItemHandlers, cmsModels } from "@/lib/cms-crud";

const { PUT, DELETE } = createItemHandlers(cmsModels.registrationField);

export { PUT, DELETE };

import { createListHandlers, cmsModels } from "@/lib/cms-crud";
import { requireSuperAdmin } from "@/app/api/cms/_lib/auth";

const { GET, POST } = createListHandlers(cmsModels.registrationField);

export { GET, POST };

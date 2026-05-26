import { describe, expect, it } from "vitest";
import { createAlertFromAI, deployTeam, getAlerts, getDeploymentBrief, updateDeploymentBrief } from "@/lib/store";

describe("deployment briefs", () => {
  it("creates and updates editable deployment details before dispatch", () => {
    const alert = createAlertFromAI("Devpur", "Water-borne diarrhea cluster", "moderate", "diarrhea");

    expect(alert).not.toBeNull();
    if (!alert) return;

    const brief = getDeploymentBrief(alert.id);

    expect(brief?.destinationVillage).toBe("Devpur");
    expect(brief?.medicines.length).toBeGreaterThan(0);
    expect(brief?.medicalTools.length).toBeGreaterThan(0);

    const updatedBrief = updateDeploymentBrief(alert.id, {
      destinationVillage: "Devpur East Camp",
      medicines: ["ORS Sachets", "Zinc Tablets"],
      medicalTools: ["BP apparatus", "Water sample containers"],
      otherRequirements: ["PPE kit", "Village announcement support"],
      fieldInstructions: ["Open triage desk near the school"],
      responseWindow: "Reach within 3 hours",
      contactPoint: "District control room and PHC coordinator",
    });

    expect(updatedBrief?.destinationVillage).toBe("Devpur East Camp");
    expect(updatedBrief?.medicines).toEqual(["ORS Sachets", "Zinc Tablets"]);
    expect(updatedBrief?.medicalTools).toEqual(["BP apparatus", "Water sample containers"]);
    expect(updatedBrief?.responseWindow).toBe("Reach within 3 hours");

    deployTeam(alert.id);

    const deployedAlert = getAlerts().find((item) => item.id === alert.id);
    expect(deployedAlert?.status).toBe("in-progress");
  });
});

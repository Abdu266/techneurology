import {
  users,
  migrainePertods,
  medications,
  medicationLogs,
  triggers,

  medicalReports,
  medicalLogs,
  assessmentTemplates,
  type User,
  type UpsertUser,
  type MigrainePeriod,
  type InsertMigrainePeriod,
  type Medication,
  type InsertMedication,
  type MedicationLog,
  type InsertMedicationLog,
  type Trigger,
  type InsertTrigger,

  type MedicalReport,
  type InsertMedicalReport,
  type MedicalLog,
  type InsertMedicalLog,
  type AssessmentTemplate,
  type InsertAssessmentTemplate,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, count, avg, sum } from "drizzle-orm";

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Migraine episode operations
  createMigrainePeriod(episode: InsertMigrainePeriod): Promise<MigrainePeriod>;
  getMigrainePeriods(userId: string, limit?: number): Promise<MigrainePeriod[]>;
  getMigrainePeriodsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<MigrainePeriod[]>;
  updateMigrainePeriod(id: number, updates: Partial<InsertMigrainePeriod>): Promise<MigrainePeriod>;
  
  // Medication operations
  createMedication(medication: InsertMedication): Promise<Medication>;
  getMedications(userId: string): Promise<Medication[]>;
  updateMedication(id: number, updates: Partial<InsertMedication>): Promise<Medication>;
  
  // Medication log operations
  createMedicationLog(log: InsertMedicationLog): Promise<MedicationLog>;
  getMedicationLogs(userId: string, limit?: number): Promise<MedicationLog[]>;
  getMedicationEffectiveness(userId: string, medicationId: number): Promise<number>;
  
  // Trigger operations
  createTrigger(trigger: InsertTrigger): Promise<Trigger>;
  getTriggers(userId: string): Promise<Trigger[]>;
  updateTriggerCorrelation(id: number, correlationScore: number): Promise<Trigger>;
  

  
  // Medical reports
  createMedicalReport(report: InsertMedicalReport): Promise<MedicalReport>;
  getMedicalReports(userId: string): Promise<MedicalReport[]>;
  
  // Medical logs
  createMedicalLog(log: InsertMedicalLog): Promise<MedicalLog>;
  getMedicalLogs(userId: string, limit?: number): Promise<MedicalLog[]>;
  getMedicalLogsByEpisode(userId: string, episodeId: number): Promise<MedicalLog[]>;
  getMedicalLogsByType(userId: string, logType: string): Promise<MedicalLog[]>;
  updateMedicalLog(id: number, updates: Partial<InsertMedicalLog>): Promise<MedicalLog>;
  deleteMedicalLog(id: number): Promise<void>;
  
  // Assessment templates
  createAssessmentTemplate(template: InsertAssessmentTemplate): Promise<AssessmentTemplate>;
  getAssessmentTemplates(userId: string): Promise<AssessmentTemplate[]>;
  updateAssessmentTemplate(id: number, updates: Partial<InsertAssessmentTemplate>): Promise<AssessmentTemplate>;
  deleteAssessmentTemplate(id: number): Promise<void>;
  
  // Analytics
  getWeeklyStats(userId: string): Promise<{
    episodeCount: number;
    avgDuration: number;
    medicationCount: number;
    weeklyData: Array<{ day: string; intensity: number }>;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Migraine episode operations
  async createMigrainePeriod(episode: InsertMigrainePeriod): Promise<MigrainePeriod> {
    const [created] = await db.insert(migrainePertods).values(episode).returning();
    return created;
  }

  async getMigrainePeriods(userId: string, limit = 50): Promise<MigrainePeriod[]> {
    return db
      .select()
      .from(migrainePertods)
      .where(eq(migrainePertods.userId, userId))
      .orderBy(desc(migrainePertods.startTime))
      .limit(limit);
  }

  async getMigrainePeriodsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<MigrainePeriod[]> {
    return db
      .select()
      .from(migrainePertods)
      .where(
        and(
          eq(migrainePertods.userId, userId),
          gte(migrainePertods.startTime, startDate),
          lte(migrainePertods.startTime, endDate)
        )
      )
      .orderBy(desc(migrainePertods.startTime));
  }

  async updateMigrainePeriod(id: number, updates: Partial<InsertMigrainePeriod>): Promise<MigrainePeriod> {
    const [updated] = await db
      .update(migrainePertods)
      .set(updates)
      .where(eq(migrainePertods.id, id))
      .returning();
    return updated;
  }

  // Medication operations
  async createMedication(medication: InsertMedication): Promise<Medication> {
    const [created] = await db.insert(medications).values(medication).returning();
    return created;
  }

  async getMedications(userId: string): Promise<Medication[]> {
    return db
      .select()
      .from(medications)
      .where(and(eq(medications.userId, userId), eq(medications.isActive, true)))
      .orderBy(desc(medications.createdAt));
  }

  async updateMedication(id: number, updates: Partial<InsertMedication>): Promise<Medication> {
    const [updated] = await db
      .update(medications)
      .set(updates)
      .where(eq(medications.id, id))
      .returning();
    return updated;
  }

  // Medication log operations
  async createMedicationLog(log: InsertMedicationLog): Promise<MedicationLog> {
    const [created] = await db.insert(medicationLogs).values(log).returning();
    return created;
  }

  async getMedicationLogs(userId: string, limit = 50): Promise<MedicationLog[]> {
    return db
      .select()
      .from(medicationLogs)
      .where(eq(medicationLogs.userId, userId))
      .orderBy(desc(medicationLogs.takenAt))
      .limit(limit);
  }

  async getMedicationEffectiveness(userId: string, medicationId: number): Promise<number> {
    const result = await db
      .select({ effectiveness: avg(medicationLogs.effectiveness) })
      .from(medicationLogs)
      .where(
        and(
          eq(medicationLogs.userId, userId),
          eq(medicationLogs.medicationId, medicationId)
        )
      );
    return Number(result[0]?.effectiveness || 0);
  }

  // Trigger operations
  async createTrigger(trigger: InsertTrigger): Promise<Trigger> {
    const [created] = await db.insert(triggers).values(trigger).returning();
    return created;
  }

  async getTriggers(userId: string): Promise<Trigger[]> {
    return db
      .select()
      .from(triggers)
      .where(eq(triggers.userId, userId))
      .orderBy(desc(triggers.correlationScore));
  }

  async updateTriggerCorrelation(id: number, correlationScore: number): Promise<Trigger> {
    const [updated] = await db
      .update(triggers)
      .set({ correlationScore })
      .where(eq(triggers.id, id))
      .returning();
    return updated;
  }



  // Medical reports
  async createMedicalReport(report: InsertMedicalReport): Promise<MedicalReport> {
    const [created] = await db.insert(medicalReports).values(report).returning();
    return created;
  }

  async getMedicalReports(userId: string): Promise<MedicalReport[]> {
    return db
      .select()
      .from(medicalReports)
      .where(eq(medicalReports.userId, userId))
      .orderBy(desc(medicalReports.generatedAt));
  }

  // Medical logs
  async createMedicalLog(log: InsertMedicalLog): Promise<MedicalLog> {
    const [created] = await db.insert(medicalLogs).values(log).returning();
    return created;
  }

  async getMedicalLogs(userId: string, limit = 50): Promise<MedicalLog[]> {
    return db
      .select()
      .from(medicalLogs)
      .where(eq(medicalLogs.userId, userId))
      .orderBy(desc(medicalLogs.timestamp))
      .limit(limit);
  }

  async getMedicalLogsByEpisode(userId: string, episodeId: number): Promise<MedicalLog[]> {
    return db
      .select()
      .from(medicalLogs)
      .where(
        and(
          eq(medicalLogs.userId, userId),
          eq(medicalLogs.episodeId, episodeId)
        )
      )
      .orderBy(desc(medicalLogs.timestamp));
  }

  async getMedicalLogsByType(userId: string, logType: string): Promise<MedicalLog[]> {
    return db
      .select()
      .from(medicalLogs)
      .where(
        and(
          eq(medicalLogs.userId, userId),
          eq(medicalLogs.logType, logType)
        )
      )
      .orderBy(desc(medicalLogs.timestamp));
  }

  async updateMedicalLog(id: number, updates: Partial<InsertMedicalLog>): Promise<MedicalLog> {
    const [updated] = await db
      .update(medicalLogs)
      .set(updates)
      .where(eq(medicalLogs.id, id))
      .returning();
    return updated;
  }

  async deleteMedicalLog(id: number): Promise<void> {
    await db.delete(medicalLogs).where(eq(medicalLogs.id, id));
  }

  // Assessment templates
  async createAssessmentTemplate(template: InsertAssessmentTemplate): Promise<AssessmentTemplate> {
    const [created] = await db.insert(assessmentTemplates).values(template).returning();
    return created;
  }

  async getAssessmentTemplates(userId: string): Promise<AssessmentTemplate[]> {
    return db
      .select()
      .from(assessmentTemplates)
      .where(
        and(
          eq(assessmentTemplates.userId, userId),
          eq(assessmentTemplates.isActive, true)
        )
      )
      .orderBy(desc(assessmentTemplates.createdAt));
  }

  async updateAssessmentTemplate(id: number, updates: Partial<InsertAssessmentTemplate>): Promise<AssessmentTemplate> {
    const [updated] = await db
      .update(assessmentTemplates)
      .set(updates)
      .where(eq(assessmentTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteAssessmentTemplate(id: number): Promise<void> {
    await db.delete(assessmentTemplates).where(eq(assessmentTemplates.id, id));
  }

  // Analytics
  async getWeeklyStats(userId: string): Promise<{
    episodeCount: number;
    avgDuration: number;
    medicationCount: number;
    weeklyData: Array<{ day: string; intensity: number }>;
  }> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get episode count for the week
    const episodeCountResult = await db
      .select({ count: count() })
      .from(migrainePertods)
      .where(
        and(
          eq(migrainePertods.userId, userId),
          gte(migrainePertods.startTime, weekAgo)
        )
      );

    // Get medication count for the week
    const medicationCountResult = await db
      .select({ count: count() })
      .from(medicationLogs)
      .where(
        and(
          eq(medicationLogs.userId, userId),
          gte(medicationLogs.takenAt, weekAgo)
        )
      );

    // Get episodes for weekly data visualization
    const weeklyEpisodes = await this.getMigrainePeriodsByDateRange(userId, weekAgo, new Date());

    // Calculate average duration (in hours)
    const avgDuration = weeklyEpisodes.reduce((acc, episode) => {
      if (episode.endTime) {
        const duration = (episode.endTime.getTime() - episode.startTime.getTime()) / (1000 * 60 * 60);
        return acc + duration;
      }
      return acc;
    }, 0) / (weeklyEpisodes.length || 1);

    // Create weekly data array (last 7 days)
    const weeklyData = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayEpisodes = weeklyEpisodes.filter(episode => 
        episode.startTime.toDateString() === date.toDateString()
      );
      
      const maxIntensity = dayEpisodes.length > 0 
        ? Math.max(...dayEpisodes.map(e => e.intensity))
        : 0;

      weeklyData.push({
        day: i === 0 ? 'Today' : days[date.getDay()],
        intensity: maxIntensity
      });
    }

    return {
      episodeCount: episodeCountResult[0]?.count || 0,
      avgDuration: Math.round(avgDuration * 10) / 10,
      medicationCount: medicationCountResult[0]?.count || 0,
      weeklyData
    };
  }
}

export const storage = new DatabaseStorage();

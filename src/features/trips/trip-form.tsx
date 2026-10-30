import { DatePicker, HStack, Picker, Section, Spacer, Stepper, Text } from "@expo/ui/swift-ui";
import { disabled as disabledModifier, font, foregroundStyle, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import { NativeInfoButton } from "@/features/info/info-button";
import type { InfoTopicId } from "@/features/info/topics";
import { dateAtMinutes, MAX_DAILY_PHOTOS, MAX_TOTAL_PHOTOS, minutesOfDay, type MomentMode, type StartMode } from "@/features/trips/create-form";

const TIME = ["hourAndMinute"] as const;
const DATE_TIME = ["date", "hourAndMinute"] as const;

/** Section header with its "i" button, in the look of a grouped-list header. */
export function infoHeader(title: string, topic: InfoTopicId) {
  return (
    <HStack spacing={6}>
      <Text modifiers={[font({ size: 13 }), foregroundStyle("secondary")]}>{title}</Text>
      <NativeInfoButton topic={topic} />
      <Spacer />
    </HStack>
  );
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type RevealMode = "end" | "custom";
export type LimitMode = "daily" | "total";

export type TripFormValues = {
  /** Create only: with it the start has an "Ahora" / "Otra fecha" choice; without it the start is always a date picker. */
  startMode?: StartMode;
  startsAt: number;
  endsAt: number;
  revealMode: RevealMode;
  customReveal: number;
  limitMode: LimitMode;
  photos: number;
  totalPhotos: number;
  momentMode: MomentMode;
  momentStart: number;
  momentEnd: number;
};

export type TripFormHandlers = {
  onStartModeChange: (mode: StartMode) => void;
  onStartsAtChange: (ms: number) => void;
  onEndsAtChange: (ms: number) => void;
  onRevealModeChange: (mode: RevealMode) => void;
  onCustomRevealChange: (ms: number) => void;
  onLimitModeChange: (mode: LimitMode) => void;
  onPhotosChange: (n: number) => void;
  onTotalPhotosChange: (n: number) => void;
  onMomentModeChange: (mode: MomentMode) => void;
  onMomentStartChange: (minutes: number) => void;
  onMomentEndChange: (minutes: number) => void;
};

/** Which controls are locked at this stage of the rollo (edit only; Create locks nothing). */
export type TripFormLocks = Partial<Record<"start" | "end" | "reveal" | "limitMode" | "limit" | "moment", boolean>>;

type Props = {
  values: TripFormValues;
  on: TripFormHandlers;
  locks?: TripFormLocks;
  /** Why the start / the quota type are locked, shown as the section footer. */
  notes?: { start?: string; limitMode?: string };
  /** The server's message, in the footer of the first section (under the dates). */
  whenFooter?: ReactNode;
};

/** The dates, reveal, quota and daily moment sections, shared by Create and Edit. Rendered inside a `<Form>`. */
export function TripForm({ values, on, locks = {}, notes = {}, whenFooter }: Props) {
  const lock = (locked?: boolean) => (locked ? [disabledModifier(true)] : []);
  const { startMode, limitMode, momentMode } = values;
  const whenNote = whenFooter ?? (notes.start && locks.start ? <Text>{notes.start}</Text> : undefined);

  return (
    <>
      <Section header={infoHeader("Cuándo", "dates")} footer={whenNote}>
        {startMode !== undefined && (
          <Picker label="Empieza" selection={startMode} onSelectionChange={on.onStartModeChange} modifiers={[pickerStyle("segmented")]}>
            <Text modifiers={[tag("now")]}>Ahora</Text>
            <Text modifiers={[tag("custom")]}>Otra fecha</Text>
          </Picker>
        )}
        {(startMode === undefined || startMode === "custom") && (
          <DatePicker
            title="Empieza"
            selection={new Date(values.startsAt)}
            displayedComponents={[...DATE_TIME]}
            onDateChange={(date) => on.onStartsAtChange(date.getTime())}
            modifiers={lock(locks.start)}
          />
        )}
        <DatePicker
          title="Termina"
          selection={new Date(values.endsAt)}
          displayedComponents={[...DATE_TIME]}
          onDateChange={(date) => on.onEndsAtChange(date.getTime())}
          modifiers={lock(locks.end)}
        />
      </Section>

      <Section header={infoHeader("Revelado", "reveal")} footer={<Text>Hasta el revelado nadie ve las fotos, ni las propias.</Text>}>
        <Picker
          selection={values.revealMode}
          onSelectionChange={on.onRevealModeChange}
          modifiers={[pickerStyle("segmented"), ...lock(locks.reveal)]}
        >
          <Text modifiers={[tag("end")]}>Al terminar</Text>
          <Text modifiers={[tag("custom")]}>Otro momento</Text>
        </Picker>
        {values.revealMode === "custom" && (
          <DatePicker
            title="Se revela"
            selection={new Date(values.customReveal)}
            displayedComponents={[...DATE_TIME]}
            onDateChange={(date) => on.onCustomRevealChange(date.getTime())}
            modifiers={lock(locks.reveal)}
          />
        )}
      </Section>

      <Section
        header={infoHeader("Fotos por persona", "quota")}
        footer={
          <Text>
            {locks.limitMode && notes.limitMode
              ? notes.limitMode
              : limitMode === "daily"
                ? "Cada día se renueva a la medianoche."
                : "Es el total de cada persona para todo el rollo."}
          </Text>
        }
      >
        <Picker selection={limitMode} onSelectionChange={on.onLimitModeChange} modifiers={[pickerStyle("segmented"), ...lock(locks.limitMode)]}>
          <Text modifiers={[tag("daily")]}>Por día</Text>
          <Text modifiers={[tag("total")]}>Todo el rollo</Text>
        </Picker>
        {limitMode === "daily" ? (
          <Stepper
            label={count(values.photos, "foto", "fotos")}
            value={values.photos}
            min={1}
            max={MAX_DAILY_PHOTOS}
            onValueChange={on.onPhotosChange}
            modifiers={lock(locks.limit)}
          />
        ) : (
          <Stepper
            label={count(values.totalPhotos, "foto", "fotos")}
            value={values.totalPhotos}
            min={1}
            max={MAX_TOTAL_PHOTOS}
            onValueChange={on.onTotalPhotosChange}
            modifiers={lock(locks.limit)}
          />
        )}
      </Section>

      <Section
        header={infoHeader("Momento del día", "moment")}
        footer={
          <Text>
            {momentMode === "off"
              ? "Sin aviso diario."
              : momentMode === "photo"
                ? "Un aviso por día a una hora al azar para cada uno. Tienen 15 minutos para sacar una foto."
                : "Un aviso por día a una hora al azar para cada uno. Tienen 15 minutos para sacar una foto con cada cámara; la primera es la grande."}
          </Text>
        }
      >
        <Picker selection={momentMode} onSelectionChange={on.onMomentModeChange} modifiers={[pickerStyle("segmented"), ...lock(locks.moment)]}>
          <Text modifiers={[tag("off")]}>Apagado</Text>
          <Text modifiers={[tag("photo")]}>Solo foto</Text>
          <Text modifiers={[tag("photo_selfie")]}>Dos cámaras</Text>
        </Picker>
        {momentMode !== "off" && (
          <>
            <DatePicker
              title="Desde"
              selection={dateAtMinutes(values.momentStart)}
              displayedComponents={[...TIME]}
              onDateChange={(date) => on.onMomentStartChange(minutesOfDay(date))}
              modifiers={lock(locks.moment)}
            />
            <DatePicker
              title="Hasta"
              selection={dateAtMinutes(values.momentEnd)}
              displayedComponents={[...TIME]}
              onDateChange={(date) => on.onMomentEndChange(minutesOfDay(date))}
              modifiers={lock(locks.moment)}
            />
          </>
        )}
      </Section>
    </>
  );
}

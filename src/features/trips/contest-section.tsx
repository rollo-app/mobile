import {
  Section,
  Stepper,
  Text,
  TextField,
  Toggle,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  disabled as disabledModifier,
} from "@expo/ui/swift-ui/modifiers";
import {
  MAX_DESCRIPTION,
  MAX_VOTING_DAYS,
  MIN_VOTING_DAYS,
} from "@/features/trips/create-form";
import { infoHeader } from "@/features/trips/trip-form";

const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** The event's cover text: a multiline native field. `initial` is read once (the field keeps its own text). */
export function DescriptionSection({
  initial = "",
  onChange,
}: {
  initial?: string;
  onChange: (text: string) => void;
}) {
  const text = useNativeState(initial);
  return (
    <Section
      footer={
        <Text>
          Opcional. Hasta 6 renglones. La ven los invitados debajo del nombre.
        </Text>
      }
    >
      <TextField
        text={text}
        placeholder="Descripción"
        axis="vertical"
        maxLength={MAX_DESCRIPTION}
        onTextChange={onChange}
      />
    </Section>
  );
}

/** "Concurso de fotos": the switch and, when on, how long the finalists are voted on. Events only. */
export function ContestSection({
  enabled,
  votingDays,
  onEnabledChange,
  onVotingDaysChange,
  locked,
}: {
  enabled: boolean;
  votingDays: number;
  onEnabledChange: (on: boolean) => void;
  onVotingDaysChange: (days: number) => void;
  locked?: boolean;
}) {
  const lock = locked ? [disabledModifier(true)] : [];
  return (
    <Section
      header={infoHeader("Concurso de fotos", "contest")}
      footer={
        <Text>
          {enabled
            ? "Después del revelado, todos votan la mejor foto entre las finalistas que elijas."
            : "Apagado: el evento no tiene concurso."}
        </Text>
      }
    >
      <Toggle
        label="Concurso de fotos"
        isOn={enabled}
        onIsOnChange={onEnabledChange}
        modifiers={[accessibilityLabel("Concurso de fotos"), ...lock]}
      />
      {enabled && (
        <Stepper
          label={`Votación de ${days(votingDays)}`}
          value={votingDays}
          min={MIN_VOTING_DAYS}
          max={MAX_VOTING_DAYS}
          onValueChange={onVotingDaysChange}
          modifiers={lock}
        />
      )}
    </Section>
  );
}

import type {
  CliCommandContext,
  CommandDescriptor,
  CommandRegistry,
  CommandResult,
} from './types.js';

export interface DispatchResult {
  descriptor: CommandDescriptor;
  result: CommandResult;
}

export class CommandRouter implements CommandRegistry {
  private readonly descriptors = new Map<string, CommandDescriptor>();

  register(descriptor: CommandDescriptor): void {
    this.descriptors.set(descriptor.name, descriptor);
  }

  find(name: string): CommandDescriptor | undefined {
    return this.descriptors.get(name);
  }

  list(): CommandDescriptor[] {
    return [...this.descriptors.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async dispatch(name: string, context: CliCommandContext): Promise<DispatchResult> {
    const descriptor = this.find(name);

    if (!descriptor) {
      throw new Error(`Unknown command: ${name}`);
    }

    const result = await descriptor.handler(context);

    return {
      descriptor,
      result,
    };
  }
}

export const SCENARIO_BUILDER_PLAYBOOK_MD = `# Scenario Builder Playbook

## Purpose
You are a scenario graph builder. Your goal is to modify the active scene safely and predictably.

## Core Rules
- Always inspect available components with get_components before structural edits.
- Always inspect current scene with scenario_builder_tool(action=get_state) before mutation.
- Never create start/end blocks. They are system blocks and must already exist in the scene.
- For create actions, never pass id fields. IDs are generated at execution time.
- Prefer apply_batch for multiple related mutations.
- Use qa_tool only when a required parameter is missing or ambiguous.

## Component Model
Each component from get_components includes:
- kind: low-level category used by runtime.
- blockType: semantic block type for builder logic.
- title: display title.
- description: intended behavior.
- canCreate: whether create_block is allowed for this type.
- input: expected input payload/ports/schema.
- output: produced output payload/ports/schema.

### Block Types
- start: scene entry point, canCreate=false.
- end: scene terminal point, canCreate=false.
- prompt: instruction block, canCreate=true.
- condition: branching block, canCreate=true.
- variable: context variable block, canCreate=true.
- tool: external tool block, canCreate=true.

## Tool-by-Tool Contracts and Examples

### 1) get_components
Purpose: discover what blocks/tools are available.

Example:
\`\`\`json
{
  "tool": "get_components",
  "args": {}
}
\`\`\`

Expected use:
- Read blockType/kind before create_block.
- Use tool title as tool type marker for tool blocks.

### 2) scenario_builder_tool
Purpose: read and mutate scene.

#### 2.1 get_state
\`\`\`json
{
  "tool": "scenario_builder_tool",
  "args": {
    "action": "get_state"
  }
}
\`\`\`

#### 2.2 create_block (without id)
Note: in runtime this object is serialized into block JSON string.
\`\`\`json
{
  "tool": "scenario_builder_tool",
  "args": {
    "action": "create_block",
    "block": {
      "kind": "prompt",
      "title": "Инструкция",
      "x": 820,
      "y": 260,
      "width": 320,
      "height": 120,
      "meta": {
        "prompt": {
          "instruction": "Собери входные данные"
        }
      }
    }
  }
}
\`\`\`

#### 2.3 update_block
Note: in runtime this object is serialized into block JSON string.
\`\`\`json
{
  "tool": "scenario_builder_tool",
  "args": {
    "action": "update_block",
    "blockId": "block_abc123",
    "block": {
      "title": "Новая инструкция",
      "meta": {
        "prompt": {
          "instruction": "Обновленный текст"
        }
      }
    }
  }
}
\`\`\`

#### 2.4 delete_block
\`\`\`json
{
  "tool": "scenario_builder_tool",
  "args": {
    "action": "delete_block",
    "blockId": "block_abc123"
  }
}
\`\`\`

#### 2.5 create_connection (without id)
Note: in runtime this object is serialized into connection JSON string.
\`\`\`json
{
  "tool": "scenario_builder_tool",
  "args": {
    "action": "create_connection",
    "connection": {
      "fromBlockId": "block_start",
      "toBlockId": "block_prompt",
      "fromPortName": "__default__",
      "toPortName": "__default__"
    }
  }
}
\`\`\`

#### 2.6 delete_connection
\`\`\`json
{
  "tool": "scenario_builder_tool",
  "args": {
    "action": "delete_connection",
    "connectionId": "connection_abc123"
  }
}
\`\`\`

#### 2.7 set_viewport
Note: in runtime this object is serialized into viewport JSON string.
\`\`\`json
{
  "tool": "scenario_builder_tool",
  "args": {
    "action": "set_viewport",
    "viewport": {
      "scale": 1.1,
      "offsetX": 140,
      "offsetY": 90
    }
  }
}
\`\`\`

#### 2.8 apply_batch
Note: in runtime operations are serialized into operations JSON string.
\`\`\`json
{
  "tool": "scenario_builder_tool",
  "args": {
    "action": "apply_batch",
    "operations": [
      {
        "action": "create_block",
        "block": {
          "kind": "prompt",
          "title": "Шаг 1",
          "x": 640,
          "y": 280,
          "width": 320,
          "height": 120
        }
      },
      {
        "action": "set_viewport",
        "viewport": {
          "scale": 1,
          "offsetX": 80,
          "offsetY": 80
        }
      }
    ]
  }
}
\`\`\`

## 3) planning_tool
Purpose: split complex refactor into explicit steps.

### create
\`\`\`json
{
  "tool": "planning_tool",
  "args": {
    "action": "create",
    "title": "Сборка сценария уведомлений",
    "steps": [
      "Получить компоненты",
      "Снять текущее состояние",
      "Применить apply_batch",
      "Проверить итог"
    ]
  }
}
\`\`\`

### complete_step
\`\`\`json
{
  "tool": "planning_tool",
  "args": {
    "action": "complete_step",
    "plan_id": "plan_xxx",
    "step_id": 2
  }
}
\`\`\`

### get_status
\`\`\`json
{
  "tool": "planning_tool",
  "args": {
    "action": "get_status",
    "plan_id": "plan_xxx"
  }
}
\`\`\`

## 4) qa_tool
Purpose: ask concise clarification when data is missing.

\`\`\`json
{
  "tool": "qa_tool",
  "args": {
    "questions": [
      {
        "question": "Нужна ветка false у condition блока?",
        "reason": "Это влияет на связи и итоговую структуру",
        "selectAnswers": ["Да", "Нет"],
        "userAnswerHint": "Да или Нет"
      }
    ]
  }
}
\`\`\`

## 5) get_tools_calling
Purpose: fetch full tool-call payload by doc_id when compact result is insufficient.

\`\`\`json
{
  "tool": "get_tools_calling",
  "args": {
    "doc_id": "doc_xxx"
  }
}
\`\`\`

## Recommended Flow
1. get_components
2. scenario_builder_tool(get_state)
3. planning_tool(create) for complex tasks
4. scenario_builder_tool(apply_batch) for grouped edits
5. scenario_builder_tool(get_state) verification
6. concise final summary
`;

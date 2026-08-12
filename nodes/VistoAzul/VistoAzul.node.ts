import {
	IExecuteFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

function splitLines(value: string): string[] {
	return value
		.split(/[\n,;]+/)
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
}

export class VistoAzul implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Visto Azul',
		name: 'vistoAzul',
		icon: 'file:vistoazul.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Envie e automatize WhatsApp pela API REST do Visto Azul',
		defaults: {
			name: 'Visto Azul',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'vistoAzulApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Mensagem', value: 'message' },
					{ name: 'Contato', value: 'contact' },
					{ name: 'Campanha', value: 'campaign' },
					{ name: 'Instancia', value: 'instance' },
					{ name: 'Chat', value: 'chat' },
					{ name: 'Grupo', value: 'group' },
				],
				default: 'message',
			},

			// ---------------- Operations ----------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['message'] } },
				options: [
					{ name: 'Enviar Texto', value: 'sendText', action: 'Enviar mensagem de texto', description: 'Envia uma mensagem de texto' },
					{ name: 'Enviar Midia', value: 'sendMedia', action: 'Enviar midia', description: 'Envia imagem, video ou documento' },
					{ name: 'Enviar PIX', value: 'sendPix', action: 'Enviar cobranca PIX', description: 'Envia uma cobranca PIX na conversa' },
					{ name: 'Enviar Enquete', value: 'sendPoll', action: 'Enviar enquete', description: 'Envia uma enquete (poll)' },
					{ name: 'Baixar Midia', value: 'downloadMedia', action: 'Baixar midia recebida', description: 'Baixa a midia (audio/imagem/video/doc) de uma mensagem recebida; transcreve audio' },
					{ name: 'Marcar Como Lida', value: 'markRead', action: 'Marcar como lida', description: 'Marca uma mensagem como lida (tique azul)' },
					{ name: 'Presenca (Digitando)', value: 'presence', action: 'Enviar presenca', description: 'Envia digitando/gravando na conversa' },
					{ name: 'Reagir', value: 'react', action: 'Reagir a mensagem', description: 'Reage a uma mensagem com emoji' },
					{ name: 'Editar', value: 'editMessage', action: 'Editar mensagem', description: 'Edita uma mensagem enviada' },
					{ name: 'Apagar', value: 'deleteMessage', action: 'Apagar mensagem', description: 'Apaga uma mensagem para todos' },
						{ name: 'Enviar Convite', value: 'sendEvent', action: 'Enviar convite de calendario', description: 'Envia um convite .ics + link do Google Agenda' },
				],
				default: 'sendText',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['contact'] } },
				options: [
					{ name: 'Criar/Atualizar', value: 'upsert', action: 'Criar ou atualizar contato', description: 'Cria ou atualiza um contato' },
					{ name: 'Listar', value: 'list', action: 'Listar contatos', description: 'Lista contatos (filtra por tag)' },
					{ name: 'Importar', value: 'import', action: 'Importar contatos', description: 'Importa varios contatos de uma vez' },
				],
				default: 'upsert',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['campaign'] } },
				options: [
					{ name: 'Criar', value: 'create', action: 'Criar campanha', description: 'Cria uma campanha (disparo em massa)' },
					{ name: 'Status', value: 'get', action: 'Ver status da campanha', description: 'Consulta o status de uma campanha' },
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['instance'] } },
				options: [
					{ name: 'Listar', value: 'list', action: 'Listar instancias', description: 'Lista os numeros conectados' },
					{ name: 'Criar', value: 'create', action: 'Criar instancia', description: 'Cria uma instancia (devolve o QR code)' },
				],
				default: 'list',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['chat'] } },
				options: [
					{ name: 'Checar Numeros', value: 'check', action: 'Checar numeros no whatsapp', description: 'Verifica quais numeros tem WhatsApp' },
				],
				default: 'check',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['group'] } },
				options: [
					{ name: 'Criar', value: 'create', action: 'Criar grupo', description: 'Cria um grupo de WhatsApp' },
				],
				default: 'create',
			},

			// ---------------- Instance field (texto usa body; /wa usa header X-Instance) ----------------
			{
				displayName: 'Instancia',
				name: 'instance',
				type: 'string',
				default: '',
				description: 'Nome da instancia (numero). Use o mesmo nome que aparece em Listar Instancias.',
				displayOptions: {
					show: {
						resource: ['message', 'chat', 'group'],
					},
				},
			},

			// ---------------- Message: comuns ----------------
			{
				displayName: 'Numero',
				name: 'number',
				type: 'string',
				default: '',
				required: true,
				placeholder: '5511999999999',
				description: 'Numero de destino com DDI e DDD, so digitos',
				displayOptions: { show: { resource: ['message'], operation: ['sendText', 'sendMedia', 'sendPix', 'sendPoll', 'presence', 'react', 'sendEvent'] } },
			},

			// --- sendEvent (convite de calendario) ---
			{
				displayName: 'Titulo do Evento',
				name: 'eventTitle',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'Demo Visto Azul',
				displayOptions: { show: { resource: ['message'], operation: ['sendEvent'] } },
			},
			{
				displayName: 'Inicio (ISO)',
				name: 'eventStart',
				type: 'string',
				default: '',
				required: true,
				placeholder: '2026-08-14T15:00',
				description: 'Data/hora em ISO. Sem fuso, assume horario de Brasilia (BRT).',
				displayOptions: { show: { resource: ['message'], operation: ['sendEvent'] } },
			},
			{
				displayName: 'Duracao (min)',
				name: 'eventDuration',
				type: 'number',
				default: 30,
				displayOptions: { show: { resource: ['message'], operation: ['sendEvent'] } },
			},
			{
				displayName: 'Local / Link',
				name: 'eventLocation',
				type: 'string',
				default: '',
				placeholder: 'Google Meet: https://...',
				displayOptions: { show: { resource: ['message'], operation: ['sendEvent'] } },
			},
			{
				displayName: 'Descricao',
				name: 'eventDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['message'], operation: ['sendEvent'] } },
			},

			// --- Atendimento (acoes na conversa) ---
			{
				displayName: 'ID da Mensagem',
				name: 'messageId',
				type: 'string',
				default: '',
				required: true,
				description: 'ID da mensagem (vem no webhook quando ela chega)',
				displayOptions: { show: { resource: ['message'], operation: ['downloadMedia', 'markRead', 'react', 'editMessage', 'deleteMessage'] } },
			},
			{
				displayName: 'Transcrever Audio',
				name: 'transcribe',
				type: 'boolean',
				default: false,
				description: 'Whether to transcribe audio to text',
				displayOptions: { show: { resource: ['message'], operation: ['downloadMedia'] } },
			},
			{
				displayName: 'Presenca',
				name: 'presence',
				type: 'options',
				options: [
					{ name: 'Digitando', value: 'composing' },
					{ name: 'Gravando Audio', value: 'recording' },
					{ name: 'Parar', value: 'paused' },
				],
				default: 'composing',
				displayOptions: { show: { resource: ['message'], operation: ['presence'] } },
			},
			{
				displayName: 'Emoji',
				name: 'emoji',
				type: 'string',
				default: '',
				placeholder: 'thumbs up',
				description: 'Emoji da reacao (vazio remove a reacao)',
				displayOptions: { show: { resource: ['message'], operation: ['react'] } },
			},
			{
				displayName: 'Novo Texto',
				name: 'editText',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['editMessage'] } },
			},

			// sendText
			{
				displayName: 'Texto',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['sendText'] } },
			},

			// sendMedia
			{
				displayName: 'Tipo',
				name: 'mediaType',
				type: 'options',
				options: [
					{ name: 'Imagem', value: 'image' },
					{ name: 'Video', value: 'video' },
					{ name: 'Documento', value: 'document' },
					{ name: 'Audio (arquivo)', value: 'audio' },
					{ name: 'Nota de Voz', value: 'ptt' },
				],
				default: 'image',
				displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
			},
			{
				displayName: 'Arquivo (URL)',
				name: 'file',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://.../arquivo.jpg',
				description: 'URL publica do arquivo',
				displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
			},
			{
				displayName: 'Legenda',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
			},

			// sendPix
			{
				displayName: 'Valor',
				name: 'amount',
				type: 'number',
				default: 0,
				required: true,
				typeOptions: { numberPrecision: 2 },
				displayOptions: { show: { resource: ['message'], operation: ['sendPix'] } },
			},
			{
				displayName: 'Chave PIX',
				name: 'pixKey',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['sendPix'] } },
			},
			{
				displayName: 'Tipo da Chave',
				name: 'pixType',
				type: 'options',
				options: [
					{ name: 'Email', value: 'email' },
					{ name: 'CPF', value: 'cpf' },
					{ name: 'CNPJ', value: 'cnpj' },
					{ name: 'Telefone', value: 'phone' },
					{ name: 'Aleatoria', value: 'random' },
				],
				default: 'email',
				displayOptions: { show: { resource: ['message'], operation: ['sendPix'] } },
			},
			{
				displayName: 'Campos Adicionais',
				name: 'pixExtra',
				type: 'collection',
				placeholder: 'Adicionar campo',
				default: {},
				displayOptions: { show: { resource: ['message'], operation: ['sendPix'] } },
				options: [
					{ displayName: 'Titulo', name: 'title', type: 'string', default: '' },
					{ displayName: 'Nome do Item', name: 'itemName', type: 'string', default: '' },
					{ displayName: 'Texto', name: 'text', type: 'string', default: '' },
				],
			},

			// sendPoll
			{
				displayName: 'Pergunta',
				name: 'pollText',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
			},
			{
				displayName: 'Opcoes',
				name: 'choices',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				description: 'Uma opcao por linha (ou separadas por virgula)',
				displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
			},
			{
				displayName: 'Escolhas Permitidas',
				name: 'selectableCount',
				type: 'number',
				default: 1,
				description: 'Quantas opcoes o contato pode marcar',
				displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
			},

			// ---------------- Contact ----------------
			{
				displayName: 'Numero',
				name: 'number',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['contact'], operation: ['upsert'] } },
			},
			{
				displayName: 'Nome',
				name: 'name',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['contact'], operation: ['upsert'] } },
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				description: 'Separadas por virgula',
				displayOptions: { show: { resource: ['contact'], operation: ['upsert'] } },
			},
			{
				displayName: 'Filtrar por Tag',
				name: 'tag',
				type: 'string',
				default: '',
				description: 'Deixe vazio para listar todos',
				displayOptions: { show: { resource: ['contact'], operation: ['list'] } },
			},
			{
				displayName: 'Contatos',
				name: 'importText',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				required: true,
				placeholder: '5511999999999,Ana\n5521988888888,Bruno',
				description: 'Uma linha por contato: numero,nome',
				displayOptions: { show: { resource: ['contact'], operation: ['import'] } },
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				description: 'Tags aplicadas a todos os importados (separadas por virgula)',
				displayOptions: { show: { resource: ['contact'], operation: ['import'] } },
			},

			// ---------------- Campaign ----------------
			{
				displayName: 'Instancias',
				name: 'instances',
				type: 'string',
				default: '',
				required: true,
				description: 'Nomes das instancias que vao disparar (separadas por virgula)',
				displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
			},
			{
				displayName: 'Template',
				name: 'template',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				description: 'Aceita spintax {a|b} e variaveis {{nome}}',
				displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
			},
			{
				displayName: 'Destinatarios (JSON)',
				name: 'recipients',
				type: 'json',
				default: '=[\n  { "number": "5511999999999", "vars": { "nome": "Ana" } }\n]',
				required: true,
				displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
			},
			{
				displayName: 'Opcoes',
				name: 'campaignExtra',
				type: 'collection',
				placeholder: 'Adicionar opcao',
				default: {},
				displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
				options: [
					{ displayName: 'Delay Min (ms)', name: 'minDelayMs', type: 'number', default: 8000 },
					{ displayName: 'Delay Max (ms)', name: 'maxDelayMs', type: 'number', default: 40000 },
					{
						displayName: 'Agendar Para (epoch ms)',
						name: 'scheduledForMs',
						type: 'number',
						default: 0,
						description: 'Momento em milissegundos (epoch). 0 = envia agora',
					},
				],
			},
			{
				displayName: 'ID da Campanha',
				name: 'campaignId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['campaign'], operation: ['get'] } },
			},

			// ---------------- Instance ----------------
			{
				displayName: 'Nome',
				name: 'newInstanceName',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'vendas',
				displayOptions: { show: { resource: ['instance'], operation: ['create'] } },
			},

			// ---------------- Chat ----------------
			{
				displayName: 'Numeros',
				name: 'numbers',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				description: 'Um numero por linha (ou separados por virgula)',
				displayOptions: { show: { resource: ['chat'], operation: ['check'] } },
			},

			// ---------------- Group ----------------
			{
				displayName: 'Nome do Grupo',
				name: 'groupName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['group'], operation: ['create'] } },
			},
			{
				displayName: 'Participantes',
				name: 'participants',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Um numero por linha (ou separados por virgula)',
				displayOptions: { show: { resource: ['group'], operation: ['create'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('vistoAzulApi');
		const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let method: IHttpRequestMethods = 'POST';
				let path = '';
				const body: IDataObject = {};
				const qs: IDataObject = {};
				const headers: IDataObject = {};

				if (resource === 'message') {
					const instance = this.getNodeParameter('instance', i, '') as string;
					const number = this.getNodeParameter('number', i, '') as string;

					if (operation === 'sendText') {
						path = '/messages/text';
						if (instance) body.instance = instance;
						body.number = number;
						body.text = this.getNodeParameter('text', i) as string;
					} else if (operation === 'sendMedia') {
						path = '/wa/send/media';
						if (instance) headers['X-Instance'] = instance;
						body.number = number;
						body.type = this.getNodeParameter('mediaType', i) as string;
						body.file = this.getNodeParameter('file', i) as string;
						const caption = this.getNodeParameter('caption', i, '') as string;
						if (caption) body.text = caption;
					} else if (operation === 'sendPix') {
						path = '/wa/send/request-payment';
						if (instance) headers['X-Instance'] = instance;
						body.number = number;
						body.amount = this.getNodeParameter('amount', i) as number;
						body.pixKey = this.getNodeParameter('pixKey', i) as string;
						body.pixType = this.getNodeParameter('pixType', i) as string;
						const extra = this.getNodeParameter('pixExtra', i, {}) as IDataObject;
						Object.assign(body, extra);
					} else if (operation === 'sendPoll') {
						path = '/wa/send/menu';
						if (instance) headers['X-Instance'] = instance;
						body.type = 'poll';
						body.number = number;
						body.text = this.getNodeParameter('pollText', i) as string;
						body.choices = splitLines(this.getNodeParameter('choices', i) as string);
						body.selectableCount = this.getNodeParameter('selectableCount', i, 1) as number;
					} else if (operation === 'downloadMedia') {
						path = '/messages/media';
						if (instance) body.instance = instance;
						body.id = this.getNodeParameter('messageId', i) as string;
						if (this.getNodeParameter('transcribe', i, false) as boolean) body.transcribe = true;
					} else if (operation === 'markRead') {
						path = '/messages/read';
						if (instance) body.instance = instance;
						body.id = this.getNodeParameter('messageId', i) as string;
					} else if (operation === 'presence') {
						path = '/messages/presence';
						if (instance) body.instance = instance;
						body.number = number;
						body.presence = this.getNodeParameter('presence', i) as string;
					} else if (operation === 'react') {
						path = '/messages/react';
						if (instance) body.instance = instance;
						body.number = number;
						body.id = this.getNodeParameter('messageId', i) as string;
						body.emoji = this.getNodeParameter('emoji', i, '') as string;
					} else if (operation === 'editMessage') {
						path = '/messages/edit';
						if (instance) body.instance = instance;
						body.id = this.getNodeParameter('messageId', i) as string;
						body.text = this.getNodeParameter('editText', i) as string;
					} else if (operation === 'deleteMessage') {
						path = '/messages/delete';
						if (instance) body.instance = instance;
						body.id = this.getNodeParameter('messageId', i) as string;
					} else if (operation === 'sendEvent') {
							path = '/messages/event';
							if (instance) body.instance = instance;
							body.number = number;
							body.title = this.getNodeParameter('eventTitle', i) as string;
							body.start = this.getNodeParameter('eventStart', i) as string;
							const dur = this.getNodeParameter('eventDuration', i, 30) as number;
							if (dur) body.durationMin = dur;
							const loc = this.getNodeParameter('eventLocation', i, '') as string;
							if (loc) body.location = loc;
							const desc = this.getNodeParameter('eventDescription', i, '') as string;
							if (desc) body.description = desc;
						}
				} else if (resource === 'contact') {
					if (operation === 'upsert') {
						path = '/contacts';
						body.number = this.getNodeParameter('number', i) as string;
						const name = this.getNodeParameter('name', i, '') as string;
						if (name) body.name = name;
						const tags = this.getNodeParameter('tags', i, '') as string;
						if (tags) body.tags = splitLines(tags);
					} else if (operation === 'list') {
						method = 'GET';
						path = '/contacts';
						const tag = this.getNodeParameter('tag', i, '') as string;
						if (tag) qs.tag = tag;
					} else if (operation === 'import') {
						path = '/contacts/import';
						body.text = this.getNodeParameter('importText', i) as string;
						const tags = this.getNodeParameter('tags', i, '') as string;
						if (tags) body.tags = splitLines(tags);
					}
				} else if (resource === 'campaign') {
					if (operation === 'create') {
						path = '/campaigns';
						body.instances = splitLines(this.getNodeParameter('instances', i) as string);
						body.template = this.getNodeParameter('template', i) as string;
						const recipientsRaw = this.getNodeParameter('recipients', i) as string | IDataObject[];
						body.recipients =
							typeof recipientsRaw === 'string' ? JSON.parse(recipientsRaw) : recipientsRaw;
						const extra = this.getNodeParameter('campaignExtra', i, {}) as IDataObject;
						Object.assign(body, extra);
					} else if (operation === 'get') {
						method = 'GET';
						path = `/campaigns/${this.getNodeParameter('campaignId', i) as string}`;
					}
				} else if (resource === 'instance') {
					if (operation === 'list') {
						method = 'GET';
						path = '/instances';
					} else if (operation === 'create') {
						path = '/instances';
						body.name = this.getNodeParameter('newInstanceName', i) as string;
					}
				} else if (resource === 'chat') {
					if (operation === 'check') {
						path = '/wa/chat/check';
						const instance = this.getNodeParameter('instance', i, '') as string;
						if (instance) headers['X-Instance'] = instance;
						body.numbers = splitLines(this.getNodeParameter('numbers', i) as string);
					}
				} else if (resource === 'group') {
					if (operation === 'create') {
						path = '/wa/group/create';
						const instance = this.getNodeParameter('instance', i, '') as string;
						if (instance) headers['X-Instance'] = instance;
						body.name = this.getNodeParameter('groupName', i) as string;
						body.participants = splitLines(this.getNodeParameter('participants', i, '') as string);
					}
				}

				if (!path) {
					throw new NodeOperationError(
						this.getNode(),
						`Operacao nao suportada: ${resource}/${operation}`,
						{ itemIndex: i },
					);
				}

				const options: IHttpRequestOptions = {
					method,
					url: `${baseUrl}${path}`,
					json: true,
				};
				if (Object.keys(body).length > 0) options.body = body;
				if (Object.keys(qs).length > 0) options.qs = qs;
				if (Object.keys(headers).length > 0) options.headers = headers;

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'vistoAzulApi',
					options,
				);

				const responseData = Array.isArray(response) ? response : [response];
				for (const entry of responseData) {
					returnData.push({
						json: entry as IDataObject,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
